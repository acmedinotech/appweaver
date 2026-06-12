import { randomUUID } from "crypto";
import { Model, Property } from "./decorators";
import { makeEntityLifecycleManager } from "./lifecycle";

const collection = 'lifecycle';

const rootEmid = 'lifecycle@root';

@Model({
    collection,
    name: 'root',
    preserveKeys: ['keepme', 'ignoreme'],
    ignoreKeys: ['ignoreme']
})
class Root {
    @Property({ isRequired: true })
    title = '';

    @Property({ isAutoCreated: true, autoCreatedValue: () => new Date() })
    createdAt?: Date;

    @Property({ isAutoUpdated: true, autoUpdatedValue: () => new Date() })
    updatedAt?: Date;
}

describe('entity/lifecycle', () => {
    const lc = makeEntityLifecycleManager(rootEmid);
    const userCreateData = {title: 'created', keepme: 'kept', ignoreme: true};
    const userUpdateData = {title: 'modified', createdAt: new Date()};

    describe('#prepareData()', () => {
        it('prepares data for create', () => {
            const result = lc.prepareData({ mode: 'create', userData: userCreateData });
            const {createdAt, ...data} = result.data;
            expect(data).toEqual({ title: 'created', keepme: 'kept' });
            expect(createdAt).toBeInstanceOf(Date);
            expect(result.removed).toEqual({ ignoreme: true });
        });

        it('prepares data for update', () => {
            const result = lc.prepareData({ mode: 'update', userData: userUpdateData });
            console.log('result', result);      
            const {updatedAt, createdAt,...data} = result.data;
            expect(data).toEqual({ title: 'modified' });
            expect(createdAt).toBeUndefined();
            expect(updatedAt).toBeInstanceOf(Date);
            expect(result.removed).toEqual({ createdAt: userUpdateData.createdAt });
        });
    });

    describe('#hydrateEntity()', () => {
    });

    describe('#dehydrateEntity()', () => {
    });
});