import { Model, Property, PropertyValidationError, Validator, type ModelDefinition } from "./decorators";
import { getModelDefinition, standardEntityValidation } from "./services";

@Model({
    name: 'testModel',
    collection: 'testCollection',
})
class BaseModel {
    @Property({ isRequired: true })
    name?: string;
    @Property({ isTypeOf: ['number'] })
    age = 0;
    @Property({ isArray: true, isTypeOf: ['string'] })
    streetAddresses: string[] = [];
    @Property({ isArray: true, isTypeOf: ['number'] })
    ages: number[] = [];
}

describe('entity/services', () => {
    const baseModelDef = getModelDefinition(new BaseModel()) as ModelDefinition;
    describe('test with BaseModel', () => {
        it('fails standard validation', () => {
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

            expect(data).toMatchObject(entityData);
        });
    });

    describe('validation & inheritance testing', () => {
        @Model({
            name: 'model.instanceValidator',
            collection: 'testCollection',
        })
        class ModelWithInstanceValidator extends BaseModel {
            @Validator()
            validateEntity(modelDef: ModelDefinition) {
                if (this.name === 'force-error')
                    return new PropertyValidationError('model.instanceValidator', 'force-error detected');
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
                    return new PropertyValidationError('model.staticValidator', 'force-error detected');
                return standardEntityValidation(modelDef, entity);
            }
        }

        it('invokes instance validateEntity()', () => {
            const modelDef = getModelDefinition(ModelWithInstanceValidator) as ModelDefinition;;
            const entity = modelDef.hydrateEntity({ name: 'force-error', age: 30 });
            const validationError = modelDef.validateEntity(entity);

            expect(validationError?.toJson()).toEqual({
                "contextName": "entity.property.validation-error",
                "message": "force-error detected",
                "propertyName": "model.instanceValidator"
            });
        });

        it('invokes static validateEntity()', () => {
            const modelDef = getModelDefinition(ModelWithStaticValidator) as ModelDefinition;
            const entity = modelDef.hydrateEntity({ name: 'force-error-static', age: 60 });
            const validationError = modelDef.validateEntity(entity);

            expect(validationError?.toJson()).toEqual({
                "contextName": "entity.property.validation-error",
                "message": "force-error detected",
                "propertyName": "model.staticValidator"
            });
        });
    });
});