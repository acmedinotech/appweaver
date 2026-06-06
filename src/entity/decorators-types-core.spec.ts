import { resolveTlsa } from "node:dns";
import { EntityValidationError, makeValidatingPropertyAccessors, Model, Property, PropertyValidationError, standardPropertyValidation, Validator, type EntityValidatorFn, type PropertyMetadata, type StandardEntity } from "./decorators-types-core";
import { constants } from "node:buffer";

describe('entity/decorators-types-core', () => {
    describe('#standardPropertyValidation', () => {
        const isRequiredScenarios = [
            {
                title: "isRequired: fails on value=null",
                isRequired: true,
                value: null,
                errorMessage:'property-required (actual: null)'
            },
            {
                title: "isRequired: fails on value=undefined",
                isRequired: true,
                value: undefined,
                errorMessage:'property-required (actual: undefined)'
            },
            {
                title: "isRequired: succeeds on value=null",
                isRequired: false,
                value: null,
            },
        ];
        const isArrayScenarios = [
            {
                title: "isArray: succeeds on value=[undefined,null, [], ['a']]",
                isArray: true,
                multiValues: [undefined, null, [], ['a']],
            },
            {
                title: "isArray: fails on value=non-array",
                isArray: true,
                value: 'a',
                errorMessage: 'property-array (actual: string)'
            }
        ] as any[];

        const multiValues = [undefined, null, {}, [], 'a', 1, true, false];
        const isTypeOfScenarios = [
            {
                title: "isTypeOf: succeeds when undefined",
                isArray: true,
                values: multiValues
            },
            {
                title: "isTypeOf:succeeds when []",
                isArray: true,
                values: multiValues
            },
            {
                title: "isTypeOf: succeeds when *",
                isArray: true,
                isTypeOf: '*',
                values: multiValues,
            },
            {
                title: "isTypeOf: succeeds when [*]",
                multiValues: [undefined, 1, "a"],
                isTypeOf: ['*']
            },
            {
                title: "isTypeOf: fails when boolean",
                multiValues: [undefined],
                isTypeOf: "boolean",
                errorMessage: "property-typeOf-[boolean] (actual: [undefined])"
            },
            {
                title: "isTypeOf: fails when [boolean]",
                multiValues: [undefined],
                isTypeOf: ["boolean"],
                errorMessage: "property-typeOf-[boolean] (actual: [undefined])"
            },
            {
                title: "isTypeOf: succeeds when [number,string]",
                value: [1, "a", 1.1],
                isArray: true,
                isTypeOf: ['number', 'string']
            },
            {
                title: "isTypeOf: fails when [number,string]",
                isArray: true,
                isTypeOf: ['number', 'string'],
                value: [1, "a", false],
                errorMessage: "property-typeOf-[number, string] (actual: [number, string, boolean])"
            },
        ];

        const fixedValues = { 2: 'two', 'b': 'bapple' };
        const fixedValuesScenarios = [
            {
                title: "fixedValues: succeeds on valid single value",
                multiValues: ['2', 'b'],
                fixedValues,
            },
            {
                title: "fixedValues: fails on invalid single value",
                multiValues: [1, 'a'],
                fixedValues,
                errorMessage: "property-fixedValues (see `properties.test-key`)"
            },
            {
                title: "fixedValues: succeeds on valid array value",
                isArray: true,
                fixedValues,
                value: ['2', 'b'],
            },
            {
                title: "fixedValues: fails on invalid array value",
                isArray: true,
                fixedValues,
                value: [1, 'a'],
                errorMessage: "property-fixedValues (see `properties.test-key`)"
            }
        ];
        const validate = (v: any) => {
            if (v === 'do-error') return new PropertyValidationError({property: 'test', message: 'do-error triggered'})
        }
        const customValidateScenarios = [
            {
                title: "validate: succeeds on custom validator",
                validate
            },
            {
                title: "validate: fails on custom validator",
                validate,
                value: 'do-error',
                errorMessage: 'do-error triggered'
            },
        ];

        it.each([...isRequiredScenarios, ...isArrayScenarios, ...isTypeOfScenarios, ...fixedValuesScenarios, ...customValidateScenarios])
            ("$title", ({value, multiValues, errorMessage, ...rest}) => {
                const doAssert = (value: any) => {
                    const error = standardPropertyValidation(value, "test-key", rest as PropertyMetadata, "noemid");
                    expect(error?.message).toBe(errorMessage);              
                }
                if (multiValues) {
                    multiValues.forEach(doAssert)
                } else {
                    doAssert(value)
                }

        })
    });

    describe('#makeValidatingPropertyAccessors', () => {
        const propsMetaMap: Record<string, Partial<PropertyMetadata>> = {
            required: {
                name: 'required',
                isRequired: true,
            },
            array: {
                name: 'array',
                isArray: true,
            }
        }
        const mockObject:any = {required: 'y', array: [1]};

        it('successfully injects accessors', () => {
            const injected = makeValidatingPropertyAccessors({...mockObject}, 'test', propsMetaMap, {...mockObject});

            try {
                injected.required = undefined
            } catch (error: any) {
                expect(error).toBeInstanceOf(PropertyValidationError);
                expect(error.message).toEqual('property-required (actual: undefined)');
            }
            try {
                injected.array = 'a'
            } catch (error: any) {
                expect(error).toBeInstanceOf(PropertyValidationError);
                expect(error.message).toEqual('property-array (actual: string)');
            }

            expect(injected.required).toBe('y');
            expect(injected.array).toEqual([1]);

            injected.required = 'n';
            injected.array = [2];

            expect(injected.required).toBe('n');
            expect(injected.array).toEqual([2]);
        })
    });

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
            const testModel = new TestModel();

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