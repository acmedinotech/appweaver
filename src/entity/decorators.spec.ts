import { Model, Property, Validator } from "./decorators";
import { asStandardEntity, EntityValidationError, PropertyValidationError } from "./types";

describe('entity/decorators', () => {
    @Model({
        name: 'testModel',
        collection: 'test',
    })
    class TestModel {
        @Property({ isRequired: true })
        name = 'test';

        @Validator()
        validate() {
            if (this.name === 'force-error')
                return new EntityValidationError('force-error detected', 'testModel');
        }
    }

    describe('@Model decorator', () => {
        it('enhances TestModel to conform to StandardEntity', () => {
            const testModel = asStandardEntity(new TestModel());

            expect(testModel.$id).toBeUndefined();
            expect(testModel.$emid).toEqual('test@testModel');

            try {
                testModel.name = undefined;
                throw new Error('expected error for undefined');
            } catch (error: any) {
                expect(error).toBeInstanceOf(PropertyValidationError);
                expect(error.message).toEqual('property-required (actual: undefined)');
            }
            
            try {
                testModel.name = 'force-error';
                testModel.$assertValidEntity();
                throw new Error('expected error for invalid entity');
            } catch (error: any) {
                // console.log('error', error);
                expect(error).toBeInstanceOf(EntityValidationError);
                expect(error.message).toEqual('force-error detected');
            }
        });
    });
});