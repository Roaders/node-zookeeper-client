import { Record, RecordConstructor } from "./record";
import { Jute, Argument, Specification } from "./specification";


/**
 * Generate a Protocol class according to the specification.
 * @for module.jute
 * @method generateClass
 */
function generateClass(moduleName: string, className: string): RecordConstructor {
    const spec = Jute[moduleName][className] as unknown as Argument[];

    return class extends Record{
        constructor(...args: any[]){
            super(spec, args.concat())
        }
    };
}

function generateRecords(): Specification<RecordConstructor> {

    const specification: Specification<RecordConstructor> = {} as any;

    Object.keys(Jute).forEach((moduleName) => {
        // Modules like protocol or data.
        const specModule = specification[moduleName] || {};
        specification[moduleName] = specModule as any;

        Object.keys(specification[moduleName]).forEach(className => {
            specModule[className] = generateClass(moduleName, className);
        });
    });

    return specification;
}

export const jute = generateRecords();
