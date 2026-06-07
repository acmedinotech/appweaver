import { resolveTlsa } from "node:dns";
import { EntityValidationError, makeValidatingPropertyAccessors, Model, Property, PropertyValidationError, standardPropertyValidation, Validator, type EntityValidatorFn, type PropertyMetadata, type StandardEntity } from ".";
import { constants } from "node:buffer";

describe('entity/core', () => {
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
                isTypeOf: "boolean",
                value: 1,
                errorMessage: "property-typeOf-[boolean] (actual: [number])"
            },
            {
                title: "isTypeOf: fails when [boolean]",
                isTypeOf: ["boolean"],
                value: "b",
                errorMessage: "property-typeOf-[boolean] (actual: [string])"
            },
            {
                title: "isTypeOf: succeeds when [number,string]",
                isArray: true,
                isTypeOf: ['number', 'string'],
                value: [1, "a", 1.1],
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
                isArray: true,
                fixedValues,
                value: ['b', 3],
                errorMessage: "property-fixedValues (not-allowed: 3)"
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
                errorMessage: "property-fixedValues (not-allowed: 1; a)"
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
                console.log(rest.title, ' >>>>')
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
            const injected = makeValidatingPropertyAccessors({...mockObject}, 'test', propsMetaMap as Record<string, PropertyMetadata>, {...mockObject});

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
});