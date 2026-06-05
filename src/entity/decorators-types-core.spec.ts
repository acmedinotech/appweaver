import { resolveTlsa } from "node:dns";
import { PropertyValidationError, standardPropertyValidation, type EntityValidatorFn, type PropertyMetadata } from "./decorators-types-core";
import { constants } from "node:buffer";

describe('entity/decorators-types-core', () => {
    describe('#standardPropertyValidation', () => {
        const isRequiredScenarios = [
            {
                title: "fails on null (required=true)",
                isRequired: true,
                value: null,
                errorMessage:'property-required (actual: null)'
            },
            {
                title: "fails on undefined (required=true)",
                isRequired: true,
                value: undefined,
                errorMessage:'property-required (actual: undefined)'
            },
            {
                title: "succeeds on null (required=false)",
                isRequired: false,
                value: null,
                errorMessage: undefined
            },
        ];
        const isArrayScenarios = [
            {
                title: "succeeds on [undefined,null, [], ['a']] (array=true)",
                isArray: true,
                multiValues: [undefined, null, [], ['a']],
                errorMessage: undefined
            },
            {
                title: "fails on non-array (array=true)",
                isArray: true,
                value: 'a',
                errorMessage: 'property-array (actual: string)'
            }
        ] as any[];
        const isTypeOfScenarios = [
            {
                title: "succeeds on isTypeOf=undefined",
                multiValues: [undefined, 1, "a"]
            },
            {
                title: "succeeds on isTypeOf=[]",
                multiValues: [undefined, 1, "a"]
            },
            {
                title: "succeeds on isTypeOf='*'",
                multiValues: [undefined, 1, "a"],
                isTypeOf: '*'
            },
            {
                title: "succeeds on isTypeOf=['*']",
                multiValues: [undefined, 1, "a"],
                isTypeOf: ['*']
            },
            {
                title: "errors on isTypeOf=boolean",
                multiValues: [undefined],
                isTypeOf: "boolean",
                errorMessage: "property-typeOf-[boolean] (actual: [undefined])"
            },
            {
                title: "errors on isTypeOf=[boolean]",
                multiValues: [undefined],
                isTypeOf: ["boolean"],
                errorMessage: "property-typeOf-[boolean] (actual: [undefined])"
            },
            {
                title: "succeeds on isTypeOf=[number,string]",
                value: [1, "a", 1.1],
                isArray: true,
                isTypeOf: ['number', 'string']
            },
            {
                title: "fails on isTypeOf=[number,string]",
                isArray: true,
                isTypeOf: ['number', 'string'],
                value: [1, "a", false],
                errorMessage: "property-typeOf-[number, string] (actual: [number, string, boolean])"
            },
        ];
        const fixedValuesScenarios = [
            {
                title: "🚨 missing fixedValuesScenarios",
            }
        ];

        const validate = (v) => {
            if (v === 'do-error') return new PropertyValidationError({property: 'test', message: 'do-error triggered'})
        }
        const customValidateScenarios = [
            {
                title: "succeeds on custom validate()",
                validate
            },
            {
                title: "fails on custom validate()",
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