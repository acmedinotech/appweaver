import { makeEntityLifecycleManager } from "../entity";
import { Model, Property } from "../entity";
import { getModelDefinition } from "../entity/services";

export const ENUM_MUSCLE_GROUPS = {
    chest: 'chest',
    upperBack: 'upperBack',
    lowerBack: 'lowerBack',
    shoulders: 'shoulders',
    arms: 'arms',
    arms_biceps: 'biceps',
    arms_triceps: 'triceps',
    arms_forearms: 'forearms',
    core: 'core',
    legs: 'legs',
    legs_quads: 'quads',
    legs_glutes: 'glutes',
    legs_hamstrings: 'hamstrings',
    legs_calves: 'calves',
}

export type WorkSetStruct = {
    sets: number;
    reps: number;
    weight: string;
    flag?: string;
}

export type MovementStruct = {
    _id?: string;
    name: string;
    muscleGroups: string[];
    alternatingSides?: boolean;
}

export type MovementRef = {
    _id: string;
}

export type ExerciseStruct = {
    movement?: MovementStruct | MovementRef;
    sets: WorkSetStruct[];
    circuit: string;
    notes?: string;
}

export type WorkoutSheetStruct = {
    _id?: string;
    createdAt: Date;
    updatedAt?: Date;
    exercises: ExerciseStruct[];
}

@Model({ collection: 'workout-sheet', name: 'workout-sheet' })
export class WorkoutSheet implements WorkoutSheetStruct {
    @Property({ isAutoCreated: true })
    _id?: string;

    @Property({ isAutoCreated: true })
    createdAt: Date = new Date();
    
    @Property({ isAutoUpdated: true })
    updatedAt?: Date;
    
    @Property({ isArray: true, relationship: { relType: 'embedded', emid: 'workout-sheet:exercise' } })
    exercises: Exercise[] = [];
}

@Model({ collection: 'workout-sheet', name: 'exercise-movement' })
export class Movement implements MovementStruct {
    @Property({ isAutoCreated: true })
    _id?: string;
    @Property({ isRequired: true })
    name: string = '';
    // @todo enum
    @Property({ isArray: true, fixedValues: {...ENUM_MUSCLE_GROUPS}, isTypeOf: ['string'], isRequired: true })
    muscleGroups: string[] = [];
    @Property()
    alternatingSides?: boolean;
}

@Model({ collection: 'workout-sheet', name: 'exercise' })
export class Exercise implements ExerciseStruct {
    @Property({ relationship: { relType: 'ref', preservedProps: ['_id'], emid: 'workout-sheet:exercise-movement' } })
    movement?: Movement;
    @Property({ isArray: true })
    sets: WorkSetStruct[] = [{sets: 0, reps: 0, weight: '0lb'}];
    @Property()
    circuit: string = '';
    @Property()
    notes?: string;
}

const movementBench: MovementStruct = {
    _id: 'bench-press',
    name: 'Bench Press',
    muscleGroups: ['chest'],
};

const movementSquat: MovementStruct = {
    _id: 'squat',
    name: 'Squat',
    muscleGroups: ['legs'],
};

const workoutSheet: WorkoutSheetStruct = {
    createdAt: new Date(),
    exercises: [
        {
            movement: movementBench,
            sets: [{sets: 3, reps: 10, weight: '100lb'}],
            circuit: 'A',
            notes: 'Notes for the bench press',
        },
        {
            movement: movementSquat,
            sets: [{sets: 4, reps: 10, weight: '100lb'}],
            circuit: 'A',
        },
    ]
}

export const getSampleWorkoutSheet = () => ({...workoutSheet})

const workoutSheetDef = getModelDefinition(WorkoutSheet);
const lifecycle = makeEntityLifecycleManager(workoutSheetDef?.getEmid() ?? '');
const entity = lifecycle.hydrateEntity({data: workoutSheet});
console.log('entity', entity);
console.log('entity.json',JSON.stringify(entity, null, 2));