import { randomUUID } from "crypto";
import { Model, Property } from "./decorators";
import { makeEntityLifecycleManager, PROP_REL_EMID } from "./lifecycle";

const collection = 'lifecycle';
const childEmid = 'lifecycle:child';
const rootEmid = 'lifecycle:root';

@Model({
    collection,
    name: 'root',
    preserveKeys: ['keepme', 'ignoreme'],
    ignoreKeys: ['ignoreme']
})
class Root {
    @Property({ isRequired: true })
    title = 'root';

    @Property({ isAutoCreated: true, autoCreatedValue: () => new Date() })
    createdAt?: Date;

    @Property({ isAutoUpdated: true, autoUpdatedValue: () => new Date() })
    updatedAt?: Date;

    @Property({ isReadOnly: true })
    readOnly = 'readonly';

    @Property({ relationship: { relType: 'child', preservedProps: ['id'] } })
    refChild?: Child;

    @Property({ relationship: { relType: 'embedded', emid: childEmid } })
    embeddedChild?: Child;
}

@Model({ collection, name: 'child' })
class Child {
    @Property({ isAutoCreated: true, autoCreatedValue: () => randomUUID })
    id?: string;

    @Property({ isRequired: true })
    title = 'child';

    @Property({ relationship: { relType: 'child', preservedProps: ['id'], emid: childEmid } })
    child?: Child;
}

describe('entity/lifecycle', () => {
    const lc = makeEntityLifecycleManager(rootEmid);
    const userCreateData = { title: 'created', keepme: 'kept', ignoreme: true, createdAt: 'dummy' };
    const userUpdateData = { title: 'modified', createdAt: new Date(), updatedAt: 'dummy', readOnly: 'cellski' };

    describe('#prepareData()', () => {
        it('prepares data for create', () => {
            const result = lc.prepareData({ mode: 'create', userData: userCreateData });
            const { createdAt, ...data } = result.data;
            expect(data).toEqual({ title: 'created', keepme: 'kept' });
            expect(createdAt).toBeInstanceOf(Date);
            expect(result.removed).toEqual({ ignoreme: true, createdAt: 'dummy' });
        });

        it('prepares data for update', () => {
            const result = lc.prepareData({ mode: 'update', userData: userUpdateData });
            const { updatedAt, createdAt, ...data } = result.data;
            expect(data).toEqual({ title: 'modified' });
            expect(createdAt).toBeUndefined();
            expect(updatedAt).toBeInstanceOf(Date);
            expect(result.removed).toEqual({ createdAt: userUpdateData.createdAt, updatedAt: 'dummy', readOnly: 'cellski' });
        });
    });

    const data = {
        title: 'hydrated.root',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        readOnly: 'hydrated.readonly',
        refChild: {
            title: 'hydrated.child',
            id: 'child-ref',
            [PROP_REL_EMID]: childEmid,
            child: {
                title: 'iii',
                id: 'child-iii',
                [PROP_REL_EMID]: childEmid,
            }
        },
        embeddedChild: {
            title: 'hydrated.embedded.child',
            id: 'embedded-child',
            [PROP_REL_EMID]: childEmid,
        }
    };

    describe('#hydrateEntity()', () => {
        const queue: any[] = [];
        const entity = lc.hydrateEntity<Root>({
            data, options: {
                queueEntityFetch: ({ entity, parent, key, ord }) => {
                    queue.push({ entity, parent, key, ord });
                }
            }
        });

        it('hydrates entity with expected values', () => {
            expect(entity.title).toEqual('hydrated.root');
            expect(entity.createdAt).toBe(data.createdAt);
            expect(entity.updatedAt).toBe(data.updatedAt)
            expect(entity.readOnly).toEqual('hydrated.readonly');
            expect(entity.refChild?.title).toEqual('hydrated.child');
            expect(entity.refChild?.id).toEqual('child-ref');
            expect(entity.refChild?.child?.title).toEqual('iii');
            expect(entity.refChild?.child?.id).toEqual('child-iii');
            expect(entity.embeddedChild?.title).toEqual('hydrated.embedded.child');
            expect(entity.embeddedChild?.id).toEqual('embedded-child');

            expect(entity.refChild).toBeInstanceOf(Child);
            expect(entity.refChild?.child).toBeInstanceOf(Child);
            expect(entity.embeddedChild).toBeInstanceOf(Child);
        });

        it('adds expected entities to queue', () => {
            expect(queue).toHaveLength(3);
            expect(queue[0].key).toBe('child');
            expect(queue[1].key).toBe('refChild');
            expect(queue[2].key).toBe('embeddedChild');
        });
    });

    @Model({ collection, name: 'newChild' })
    class NewChild extends Child {
    }

    describe('#dehydrateEntity()', () => {
        const entity = lc.hydrateEntity<Root>({ data });
        
        entity.embeddedChild = new NewChild();
        entity.embeddedChild.title = 'newChild';
        entity.embeddedChild.id = 'newChild-id';
      
        it('dehydrates entity with expected docs', () => {
            const skeleton = lc.dehydrateEntity({ entity });
            expect(skeleton).toEqual([
                {
                  _rel_emid: 'lifecycle:root',
                  title: 'hydrated.root',
                  createdAt: new Date('2026-01-01T00:00:00.000Z'),
                  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
                  readOnly: 'hydrated.readonly',
                  refChild: { id: 'child-ref', _rel_emid: 'lifecycle:child' },
                  embeddedChild: {
                    _rel_emid: 'lifecycle:newChild',
                    id: 'newChild-id',
                    title: 'newChild'
                  }
                },
                {
                  _rel_emid: 'lifecycle:child',
                  id: 'child-ref',
                  title: 'hydrated.child',
                  child: { id: 'child-iii', _rel_emid: 'lifecycle:child' }
                },
                { _rel_emid: 'lifecycle:child', id: 'child-iii', title: 'iii' },
                {
                  _rel_emid: 'lifecycle:newChild',
                  id: 'newChild-id',
                  title: 'newChild'
                }
              ])
        })
    });
});