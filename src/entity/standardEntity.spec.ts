import { makeStandardEntityClass } from "./core";
import { Model, Property } from "./decorators";
import { asStandardEntity } from "./types";

const collection = 'test';

@Model({collection, name: 'b'})
class B {
    @Property({ isRequired: true, defaultValue: () => 'test_b' })
    bprop: string;

    constructor() {
        this.bprop = 'fB_1';
    }
};

@Model({collection, name: 'a'})
class A {
    @Property({ isRequired: true, defaultValue: () => 'test_a' })
    aprop: string;

    @Property({ defaultValue: () => new B(), relationship: { relType: 'embedded' } })
    child: B;

    constructor() {
        this.aprop = 'fA_1';
        this.child = new B();
    }
};

describe('entity/standardEntity', () => {
    describe('observability', () => {
        it('cascades B to A', () => {
            const inst = asStandardEntity<A>(new A());
            inst.$observeWith(observer => {
                console.log('EVENT ', observer);
            });
            // inst.bprop = 'changed';
            inst.child.bprop = 'child-changed';
            console.log('$$$',JSON.stringify(inst, null, 2));
        })
    })
});