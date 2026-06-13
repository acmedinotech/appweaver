import { randomUUID } from "node:crypto";
import { EntityValidationError,PropertyValidationError, type ModelDefinition, type StandardEntity } from "./types";
import {Model, Property, Validator, } from "./decorators";
import { makeEntityLifecycleManager, prepareData } from "./lifecycle";
import { getModelDefinition, makeObservableEntity } from "./services";

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
        it('asserts throw-after-set validation', () => {
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

    const emid = 'testCollection@testModel';
    const baseModelDef = getModelDefinition(new BaseModel()) as ModelDefinition;
    const lcman = makeEntityLifecycleManager(emid);
    
    describe('baseline behaviors', () => {
        it('fails standard validation (asserts: isRequired, isArray, isTypeOf)', () => {
            const entity = lcman.hydrateEntity({
                data: {}
            });
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
                    throw new Error(`expected error for: ${key}=${value}`);
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
            const entity: BaseModel = lcman.hydrateEntity({
                data: entityData
            });

            expect(entity.name).toBe('Test');
            expect(entity.age).toBe(30);
            expect(entity.streetAddresses).toEqual(['123 Main St']);
        });

        it('dehydrates to JSON data', () => {
            const data = lcman.dehydrateEntity(
                { entity: lcman.hydrateEntity({data: entityData}) }
            );
            expect(data).toMatchObject([entityData]);
        });
    });

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

    describe('entity validation & inheritance', () => {
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
            const lcman = makeEntityLifecycleManager("testCollection@model.instanceValidator");
            try {
                lcman.hydrateEntity({ data: { name: 'force-error', age: 30 } });
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
            const lcman = makeEntityLifecycleManager("testCollection@model.staticValidator");
            try {
                lcman.hydrateEntity({ data: { name: 'force-error-static', age: 60 } });
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
            const lcman = makeEntityLifecycleManager("testCollection@model.instanceValidator");
            const entity: ModelWithInstanceValidator & StandardEntity = lcman.hydrateEntity({ data: { name: 'Test', age: 30 } });
            it('validates throw-after-set', () => {
                try {
                    entity.name = undefined;
                    throw new Error('expected error for undefined');
                } catch (error: any) {
                    expect(error).toBeInstanceOf(PropertyValidationError);
                    expect(error.message).toEqual('property-required (actual: undefined)')
                }

                try {
                    entity.name = 'force-error';
                    throw new Error('expected error for force-error');
                } catch (error: any) {
                    expect(error).toBeInstanceOf(PropertyValidationError);
                    expect(error.message).toEqual('force-error')
                    expect(entity.name).toBe('force-error');
                }
            });

            it('throws error on assertValidEntity()', () => {
                try {
                    entity.$assertValidEntity();
                    throw new Error('expected error for invalid entity');
                } catch (error: any) {
                    expect(error).toBeInstanceOf(EntityValidationError);
                }
            });
        });

        describe('#makeObservableEntity()', () => {
            const modelDef = getModelDefinition(ModelWithInstanceValidator) as ModelDefinition;
            const lcman = makeEntityLifecycleManager("testCollection@model.instanceValidator");
            const entity = makeObservableEntity<ModelWithInstanceValidator>(modelDef, lcman.hydrateEntity({ data: { name: 'Test', age: 30 } }));
            const events: string[] = [];
            
            const unsub1 = entity.$observeWith(({property: key, value}) => {
                events.push(`all: ${key}=${value}`)
            });
            const unsub2 = entity.$observeWith(({property: key, value}) => {
                events.push(`one: ${key}=${value}`)
            }, 'age');
            const unsub3 = entity.$observeWith(({property: key, value}) => {
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
});