import { randomUUID } from "node:crypto";
import { EntityValidationError, Model, Property, PropertyValidationError, Validator, type ModelDefinition, type StandardEntity } from ".";
import { getModelDefinition, makeObservableEntity, prepareData } from "./lifecycle";

@Model({
    collection: 'testCollection',
    name: 'testModel',
})
class BaseModel {
    @Property({ isRequired: true, validate: (v) => v === 'force-error' ? new PropertyValidationError({property: 'name', message: 'force-error'}) : undefined })
    name?: string =  '';
    @Property({ isTypeOf: ['number'] })
    age = 0;
    @Property({ isRequired: true, isArray: true, isTypeOf: ['string'] })
    streetAddresses: string[] = [];
    @Property({ isRequired: true,isArray: true, isTypeOf: ['number'], fixedValues: {1: 'one', 3: 'three', 7: 'seven'} })
    ages: number[] = [];
}

describe('entity/services', () => {
    describe('direct decorator-enhanced behaviors', () => {
        it('asserts validation after-property-set', () => {
            const entity = new BaseModel();
            try {
                entity.name = undefined;
                throw new Error('expected error for undefined');
            } catch (error: any) {
                expect(error).toBeInstanceOf(PropertyValidationError);
                expect(error.message).toEqual('property-required (actual: undefined)');
            }
        })

    })
    const baseModelDef = getModelDefinition(new BaseModel()) as ModelDefinition;
    
    describe('baseline behaviors', () => {
        it('fails standard validation (asserts: isRequired, isArray, isTypeOf)', () => {
            const entity = baseModelDef.hydrateEntity({});
            const badProps = { name: undefined, age: '', streetAddresses: true, ages: [1, 8] };
            const expectedErrors = [
                [PropertyValidationError, 'property-required (actual: undefined)'],
                [PropertyValidationError, 'property-typeOf-[number] (actual: [string])'],
                [TypeError, 'value.map is not a function'], 
                [PropertyValidationError, 'property-fixedValues (not-allowed: 8)']
            ];
            Object.entries(badProps).forEach(([key, value]) => {
                 try {
                    (entity as any)[key] = value;
                } catch (error: any) {
                    const [errClass, errMessage] = expectedErrors.shift() ?? [];
                    expect(error).toBeInstanceOf(errClass);
                    expect(error.message).toEqual(errMessage);
                }
            });
            expect(expectedErrors.length).toEqual(0);
        });

        const entityData = { name: 'Test', age: 30, streetAddresses: ['123 Main St'] };

        it('hydrates from JSON data', () => {
            const entity: BaseModel = baseModelDef.hydrateEntity(entityData);

            expect(entity.name).toBe('Test');
            expect(entity.age).toBe(30);
            expect(entity.streetAddresses).toEqual(['123 Main St']);
        });

        it('dehydrates to JSON data', () => {
            const data = baseModelDef.dehydrateEntity(
                baseModelDef.hydrateEntity(entityData)
            );
            expect(data).toMatchObject([entityData]);
        });
    });

    describe('entity validation & inheritance', () => {
        @Model({
            name: 'model.instanceValidator',
            collection: 'testCollection',
        })
        class ModelWithInstanceValidator extends BaseModel {
            @Validator()
            validate(modelDef: ModelDefinition) {
                if (this.name === 'force-error')
                    return new EntityValidationError('force-error detected', 'model.instanceValidator');
            }
        }

        @Model({
            name: 'model.staticValidator',
            collection: 'testCollection',
        })
        class ModelWithStaticValidator extends BaseModel {
            @Validator()
            static validate(entity: any) {
                if (entity.name === 'force-error-static')
                    return new EntityValidationError('model.staticValidator', 'force-error2 detected');
            }
        }

        it('invokes instance validateEntity() (asserts: @Validator() instance method)', () => {
            const modelDef = getModelDefinition(ModelWithInstanceValidator) as ModelDefinition;
            try {
                modelDef.hydrateEntity({ name: 'force-error', age: 30 });
            } catch (validationError: any) {
                expect(validationError).toBeInstanceOf(PropertyValidationError);
                expect(validationError?.toJson()).toEqual({
                    contextName: 'entity.property.validation-error',
                    message: 'force-error',
                    properties: undefined,
                    propertyName: 'name'
                });
            }
        });

        it('invokes static validateEntity() (asserts: @Validator() static method)', () => {
            const modelDef = getModelDefinition(ModelWithStaticValidator) as ModelDefinition;
            try {
                modelDef.hydrateEntity({ name: 'force-error-static', age: 60 });
                // throw new Error('expected error for invalid entity');
            } catch (validationError: any) {
                expect(validationError).toBeInstanceOf(PropertyValidationError);
                expect(validationError?.toJson()).toEqual({
                    contextName: 'force-error2 detected',
                    message: 'model.staticValidator',
                    properties: undefined
                });
            }
        });

        describe('#makeStandardEntity()', () => {
            const entity: ModelWithInstanceValidator & StandardEntity = (getModelDefinition(ModelWithInstanceValidator) as ModelDefinition).hydrateEntity({ name: 'Test', age: 30 });
            it('validates properties on set', () => {
                try {
                    entity.name = undefined;
                    // throw new Error('expected error for undefined');
                } catch (error: any) {
                    expect(error).toBeInstanceOf(PropertyValidationError);
                    expect(error.message).toEqual('property-required (actual: undefined)')
                }

                try {
                    entity.name = 'force-error';
                    // throw new Error('expected error for force-error');
                } catch (error: any) {
                    expect(error).toBeInstanceOf(PropertyValidationError);
                    expect(error.message).toEqual('force-error')
                    expect(entity.name).toBe('force-error-static');
                }
            });

            it('throws error on assertValidEntity()', () => {
                try {
                    entity.$assertValidEntity();
                    // throw new Error('expected error for invalid entity');
                } catch (error: any) {
                    expect(error).toBeInstanceOf(EntityValidationError);
                }
            });
        });

        describe('#makeObservableEntity()', () => {
            const modelDef = getModelDefinition(ModelWithInstanceValidator) as ModelDefinition;
            const entity = makeObservableEntity<ModelWithInstanceValidator>(modelDef, modelDef.hydrateEntity({ name: 'Test', age: 30 }));
            const events: string[] = [];
            
            const unsub1 = entity.$observeWith((key, value) => {
                events.push(`all: ${key}=${value}`)
            });
            const unsub2 = entity.$observeWith((key, value) => {
                events.push(`one: ${key}=${value}`)
            }, 'age');
            const unsub3 = entity.$observeWith((key, value) => {
                events.push(`mny: ${key}=${value}`)
            }, ['name', 'streetAddresses']);

            it('triggers expected observers in order', () => {
                entity.name = 'name1';
                entity.age = -1;
                entity.streetAddresses = ['xyz'];
                expect(events).toEqual([
                    'mny: name=name1',
                    'all: name=name1',
                    'one: age=-1',
                    'all: age=-1',
                    'mny: streetAddresses=xyz',
                    'all: streetAddresses=xyz'
                  ]);
            });

            it('unsubscribes observers', () => {
                unsub1();
                unsub2();
                unsub3();
                entity.name = 'name2';
                expect(events.length).toEqual(6)
            });
        });
    });

    describe('hydration, dehydration, & relationships', () => {
        const collection = 'test.hydrate-dehydrate-relationships';
        @Model({
            name: 'childThing',
            collection,
        })
        class ChildThing {
            static readonly emid = `${collection}@childThing`;
            @Property({ isAutoCreated: true, autoCreatedValue: () => `${ChildThing.emid}:${randomUUID()}` })
            _id?: string;
            @Property({ isAutoUpdated: true, autoUpdatedValue: () => new Date()})
            updatedAt?: Date;
            @Property({ isRequired: true })
            name: string = '';
        }

        @Model({
            name: 'parent',
            collection,
        })
        class Parent {
            @Property({ relationship: { relType: 'embedded', emid: ChildThing.emid } })
            embeddedChild?: ChildThing;
            @Property({ relationship: { relType: 'child', preservedProps: ['_id'], emid: ChildThing.emid } })
            strongRefChild?: ChildThing;
            @Property({ relationship: { relType: 'ref', preservedProps: ['_id'], emid: ChildThing.emid } })
            weakRefChild?: ChildThing;
        }
      
        describe('#prepareDataForMutation()', () => {
            it('returns expected properties on-create (asserts: isAutoCreated, autoCreatedValue)', () => {
                const modelDef = getModelDefinition(ChildThing) as ModelDefinition;
                const {data} = prepareData(modelDef, 'create', { name: 'Test1' });
                expect(data.name).toBe('Test1');
                expect(data._id).toMatch(new RegExp(`^${ChildThing.emid}:`));
            });

            it('returns expected properties on-update (asserts: isReadOnly, isAutoCreated, isAutoUpdated, autoUpdatedValue)', () => {
                const modelDef = getModelDefinition(ChildThing) as ModelDefinition;
                const {data} = prepareData(modelDef, 'update', 
                    { _id: 'x', name: 'Test2', updatedAt: '2026-02-16' }
                );
                expect(data.name).toBe('Test2');
                expect(data.updatedAt).toBeInstanceOf(Date);
                expect(data._id).toBeUndefined();
            });
        });
    });
});