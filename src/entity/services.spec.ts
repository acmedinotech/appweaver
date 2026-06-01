import { randomUUID } from "node:crypto";
import { EntityValidationError, Model, Property, PropertyValidationError, Validator, type ModelDefinition } from "./decorators";
import { getModelDefinition, standardEntityValidation, prepareDataForMutation, makeValidatingEntity } from "./services";

@Model({
    collection: 'testCollection',
    name: 'testModel',
})
class BaseModel {
    @Property({ isRequired: true, validate: (v) => v === 'force-error' ? new PropertyValidationError({property: 'name', message: 'force-error'}) : undefined })
    name?: string =  '';
    @Property({ isTypeOf: ['number'] })
    age = 0;
    @Property({ isArray: true, isTypeOf: ['string'] })
    streetAddresses: string[] = [];
    @Property({ isArray: true, isTypeOf: ['number'] })
    ages: number[] = [];
}

describe('entity/services', () => {
    const baseModelDef = getModelDefinition(new BaseModel()) as ModelDefinition;
    
    describe('baseline behaviors', () => {
        it('fails standard validation (asserts: isRequired, isArray, isTypeOf)', () => {
            const entity = baseModelDef.hydrateEntity({ name: undefined, age: undefined, streetAddresses: undefined, ages: ['a'] });
            const validationError = baseModelDef.validateEntity(entity);
            expect(validationError?.toJson()).toEqual({
                "contextName": "testCollection@testModel",
                "message": "entity-validation-failed: see properties",
                "properties": {
                    "name": {
                        "contextName": "testCollection@testModel",
                        "message": "property-required (actual: undefined OR null)",
                        "propertyName": "name"
                    },
                    "streetAddresses": {
                        "contextName": "testCollection@testModel",
                        "message": "property-array (expected: array, actual: undefined)",
                        "propertyName": "streetAddresses"
                    },
                    "ages": {
                        "contextName": "testCollection@testModel",
                        "message": "property-typeOf (expected: [number], actual: string)",
                        "propertyName": "ages",
                    },
                }
            });
        });

        const entityData = { name: 'Test', age: 30, streetAddresses: ['123 Main St'] };

        it('hydrates from JSON data', () => {
            const entity = baseModelDef.hydrateEntity(entityData);

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

    describe('#standardEntityValidation(), #standardPropertyValidation()', () => {
        describe('asserts: isRequired, isReadOnly, isAutoCreated,', () => {

        })
    });

    describe('entity validation & inheritance', () => {
        @Model({
            name: 'model.instanceValidator',
            collection: 'testCollection',
        })
        class ModelWithInstanceValidator extends BaseModel {
            @Validator()
            validateEntity(modelDef: ModelDefinition) {
                if (this.name === 'force-error')
                    return new EntityValidationError('force-error detected', 'model.instanceValidator');
                return standardEntityValidation(modelDef, this);
            }
        }

        @Model({
            name: 'model.staticValidator',
            collection: 'testCollection',
        })
        class ModelWithStaticValidator extends BaseModel {
            @Validator()
            static validateEntity(modelDef: ModelDefinition, entity: any) {
                if (entity.name === 'force-error-static')
                    return new EntityValidationError('model.staticValidator', 'force-error2 detected');
                return standardEntityValidation(modelDef, entity);
            }
        }

        it('invokes instance validateEntity() (asserts: @Validator() instance method)', () => {
            const modelDef = getModelDefinition(ModelWithInstanceValidator) as ModelDefinition;;
            const entity = modelDef.hydrateEntity({ name: 'force-error', age: 30 });
            const validationError = modelDef.validateEntity(entity);

            expect(validationError?.toJson()).toEqual({
                contextName: 'model.instanceValidator',
                message: 'force-error detected',
                properties: undefined
            });
        });

        it('invokes static validateEntity() (asserts: @Validator() static method)', () => {
            const modelDef = getModelDefinition(ModelWithStaticValidator) as ModelDefinition;
            const entity = modelDef.hydrateEntity({ name: 'force-error-static', age: 60 });
            const validationError = modelDef.validateEntity(entity);

            expect(validationError?.toJson()).toEqual({
                contextName: 'force-error2 detected',
                message: 'model.staticValidator',
                properties: undefined
            });
        });

        describe('#makeValidatingEntity()', () => {
            it('validates properties on set', () => {
                const entity = baseModelDef.hydrateEntity({ name: 'Test', age: 30 });
                try {
                    entity.name = undefined;
                    throw new Error('expected error');
                } catch (error: any) {
                    expect(error).toBeInstanceOf(PropertyValidationError);
                    expect(error.message).toEqual('property-required (actual: undefined OR null)')
                }

                try {
                    entity.name = 'force-error';
                    throw new Error('expected error');
                } catch (error: any) {
                    expect(error).toBeInstanceOf(PropertyValidationError);
                    expect(error.message).toEqual('force-error')
                }
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
                const {data} = prepareDataForMutation(modelDef, 'create', { name: 'Test1' });
                expect(data.name).toBe('Test1');
                expect(data._id).toMatch(new RegExp(`^${ChildThing.emid}:`));
            });

            it('returns expected properties on-update (asserts: isReadOnly, isAutoCreated, isAutoUpdated, autoUpdatedValue)', () => {
                const modelDef = getModelDefinition(ChildThing) as ModelDefinition;
                const {data} = prepareDataForMutation(modelDef, 'update', 
                    { _id: 'x', name: 'Test2', updatedAt: '2026-02-16' }
                );
                expect(data.name).toBe('Test2');
                expect(data.updatedAt).toBeInstanceOf(Date);
                expect(data._id).toBeUndefined();
            });
        });
    });
});