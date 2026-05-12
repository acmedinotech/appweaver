import { Model, Property, ValidationError, Validator, type ModelDefinition } from "./decorators";
import { getModelDefinition, hydrateModelFromData, standardEntityValidation } from "./services";

@Model({
    name: 'testModel',
    collection: 'testCollection',
})
class BaseModel {
    @Property({ isRequired: true })
    name?: string;
    @Property({ isTypeOf: ['number'] })
    age = 0;
}

describe('entity/services', () => {
    describe('test with BaseModel', () => {
        it('fails standard validation', () => {
            const entity = hydrateModelFromData(new BaseModel(), { name: undefined, age: undefined });
            const modelDef = getModelDefinition(entity);
            const validationError = modelDef?.validateEntity(entity);
            expect(validationError?.propertyName).toEqual('testCollection@testModel');
            expect(validationError?.message).toEqual('testCollection@testModel: entity-validation-failed');
            const payload = (validationError?.payload as ValidationError[])?.
                map(({propertyName, message}) => ({propertyName, message}));
            expect(payload).toMatchObject(
                [{ propertyName: 'name', message: 'name: property-required (actual: undefined OR null)' },
                { propertyName: 'age', message: 'age: property-type-of (expected: [number], actual: undefined)' },]
            );
        });
    
        it('hydrates from JSON data', () => {
            const entity = hydrateModelFromData(new BaseModel(), { name: 'Test', age: 30 });
            expect(entity.name).toBe('Test');
            expect(entity.age).toBe(30);
        });
    });

    describe('validation & inheritance testing', () => {
        @Model({
            name: 'model.instanceValidator',
            collection: 'testCollection',
        })
        class ModelWithInstanceValidator extends BaseModel {
            constructor() {
                super();
            }
            @Validator()
            validateEntity(modelDef: ModelDefinition) {
                if (this.name === 'force-error')
                    return new ValidationError('model.instanceValidator', 'force-error detected');
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
                    return new ValidationError('model.staticValidator', 'force-error detected');
                return standardEntityValidation(modelDef, entity);
            }
        }

        it('invokes instance validateEntity()', () => {
            const entity = hydrateModelFromData(new ModelWithInstanceValidator(),
                { name: 'force-error', age: 30 });
            const modelDef = getModelDefinition(entity);
            const validationError = modelDef?.validateEntity(entity);
            expect(validationError?.propertyName).toEqual('model.instanceValidator');
            expect(validationError?.message).toEqual('model.instanceValidator: force-error detected');
        });

        it('invokes static validateEntity()', () => {
            const entity = hydrateModelFromData(new ModelWithStaticValidator(),
                { name: 'force-error-static', age: 60 });
            const modelDef = getModelDefinition(entity);
            const validationError = modelDef?.validateEntity(entity);
            expect(validationError?.propertyName).toEqual('model.staticValidator');
            expect(validationError?.message).toEqual('model.staticValidator: force-error detected');
        });
    });
});