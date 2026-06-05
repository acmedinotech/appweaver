import { resolveTlsa } from "node:dns";
import { PropertyValidationError, standardPropertyValidation, type EntityValidatorFn, type PropertyMetadata } from "./decorators-types-core";
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
                title: "fixedValues: succeeds on valid values",
                multiValues: ['2', 'b', , ['2', 'b']],
                fixedValues,
            },
            {
                title: "fixedValues: fails on invalid values",
                multiValues: [1, ['a']],
                fixedValues,
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
    describe.skip('#makePrototypePropertyGetSet', () => {

    })
});