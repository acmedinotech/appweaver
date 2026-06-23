import type { ClassDecoratorMap } from "../decorator-registry";
import { assertValidEntity, makeModelDefinition, makeStandardEntityClass, makeValidatingPropertyAccessors, standardEntityValidation, standardPropertyValidation } from "./core";
import { Model } from "./decorators";
import { getModelDefinition } from "./services";
import { EntityDecorators, EntityValidationError, PropertyValidationError, type PropertyMetadata } from "./types";

describe('entity/core', () => {
    describe('#standardPropertyValidation', () => {
        const isRequiredScenarios = [
            {
                title: "isRequired: fails on value=null",
                isRequired: true,
                value: null,
                errorMessage: 'property-required (actual: null)'
            },
            {
                title: "isRequired: fails on value=undefined",
                isRequired: true,
                value: undefined,
                errorMessage: 'property-required (actual: undefined)'
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
            },
            {
                title: "isArray(false): fails on value=array",
                isArray: false,
                value: [],
                errorMessage: 'property-not-array (set `isArray`)'
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
            if (v === 'do-error') return new PropertyValidationError({ property: 'test', message: 'do-error triggered' })
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

        it.each([
            ...isRequiredScenarios,
            ...isArrayScenarios,
            ...isTypeOfScenarios,
            ...fixedValuesScenarios,
            ...customValidateScenarios
        ])
            ("$title", ({ value, multiValues, errorMessage, ...rest }) => {
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

    const propsMetaMap = {
        required: {
            name: 'required',
            isRequired: true,
        },
        array: {
            name: 'array',
            isArray: true,
        }
    } as unknown as Record<string, PropertyMetadata>;
    const allDecsInst = {
        methods: {
            [EntityDecorators.Validator]: {
                'instValidate': {}
            }
        },
        properties: {
            [EntityDecorators.Property]: propsMetaMap
        }
    } as unknown as ClassDecoratorMap;
    const allDecsStat = {
        methodsStatic: {
            [EntityDecorators.Validator]: {
                'statValidate': () => {
                    return new EntityValidationError('statValidate failed');
                }
            }
        },
        properties: {
            [EntityDecorators.Property]: propsMetaMap
        }
    } as unknown as ClassDecoratorMap;

    describe('#makeValidatingPropertyAccessors', () => {
        const mockObject: any = { required: 'y', array: [1] };

        it('successfully injects throw-after-set accessors', () => {
            const injected = makeValidatingPropertyAccessors({
                target: { ...mockObject, $__proxy: {}, $__errorState: {} },
                emid: 'test',
                propsMetaMap: propsMetaMap as Record<string, PropertyMetadata>,
            });

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

            expect(injected.required).toBe(undefined);
            expect(injected.array).toEqual('a');

            injected.required = 'n';
            injected.array = [2];

            expect(injected.required).toBe('n');
            expect(injected.array).toEqual([2]);
        })
    });

    describe('#standardEntityValidation', () => {
        const emid = 'standard.entity.validation';
        it('throws on undefined entity', () => {
            expect(() => standardEntityValidation(emid, propsMetaMap, undefined)).toThrow(Error);
        })
        it('returns undefined on valid entity', () => {
            const entity = { required: 'y', array: [1] };
            expect(standardEntityValidation(emid, propsMetaMap, entity)).toBeUndefined();
        })
        it('returns EntityValidationError on invalid entity', () => {
            const entity = { required: undefined, array: [1] };
            expect(standardEntityValidation(emid, propsMetaMap, entity)).toBeInstanceOf(EntityValidationError);
        })
    });

    describe('#assertValidEntity', () => {
        const emid = 'assert.valid.entity';
        const entity = {
            required: 'y', array: [1], $__errorState: {}, $__proxy: {},
            instValidate: () => {
                return new EntityValidationError('instValidate failed');
            },
            constructor: {
                statValidate: () => {
                    return new EntityValidationError('statValidate failed');
                }
            }
        } as any;

        it('throws on non-empty $__errorState', () => {
            expect(() => assertValidEntity({ ...entity, $__errorState: { required: 'n' } }, emid, allDecsInst)).toThrow(EntityValidationError);
        })
        it('invokes instance validator if present', () => {
            const e = { ...entity, $__proxy: { required: 'n' } };
            expect(() => assertValidEntity(e, emid, allDecsInst)).toThrow("instValidate failed");
        });
        it('invokes static validator if present', () => {
            const e = { ...entity, $__proxy: { required: 'n' } };
            expect(() => assertValidEntity(e, emid, allDecsStat)).toThrow("statValidate failed");
        });
        it('throws TypeError if no validator is present', () => {
            const e = { ...entity, $__proxy: { required: 'n' } };
            delete e.instValidate;
            expect(() => assertValidEntity(e, emid, allDecsInst)).toThrow(TypeError);
        });
    });

    describe('#makeStandardEntityClass', () => {
        @Model({collection: 'test', name: 'test', idKey: '__id'})
        class LocalClass { };
        const allDecs = {...allDecsInst, class: {
            [EntityDecorators.Model]: {
                idKey: '__id',
            }
        }}
        const modelDef = getModelDefinition(LocalClass);
        const NewClass = makeStandardEntityClass(LocalClass, modelDef);
        it('extends original class to make Entity & ProxyEntity & StandardEntity', () => {
            const inst = new NewClass();
            expect(inst.$id).toBe('__id');
            expect(inst.$emid).toBe('test:test');
            expect(inst.$__proxy).toEqual({});
            expect(inst.$__errorState).toEqual({});

        });
    });

    describe('#makeModelDefinition', () => {
        it('creates a ModelDefinition instance from a ClassDecoratorMap', () => {
            const allDecs = {...allDecsInst, class: {
                [EntityDecorators.Model]: {
                    name: 'mmd',
                    collection: 'c',
                    idKey: '__id',
                }
            }}
            const modelDef = makeModelDefinition(allDecs);
            expect(modelDef.modelMetadata.idKey).toBe('__id');
            expect(modelDef.properties.required.name).toBe('required');
            expect(modelDef.properties.required.isRequired).toBe(true);
            expect(modelDef.getEmid()).toBe('c:mmd');
            expect(typeof modelDef.createInstance).toBe('function');
        });
    });
});
