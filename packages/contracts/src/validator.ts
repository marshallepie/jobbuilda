import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: string[];
}

export class SchemaValidator<T> {
  private validator: ValidateFunction<T>;

  constructor(schema: JSONSchemaType<T>) {
    this.validator = ajv.compile(schema);
  }

  validate(data: unknown): ValidationResult<T> {
    const valid = this.validator(data);

    if (valid) {
      return { valid: true, data: data as T };
    }

    return {
      valid: false,
      errors: this.validator.errors?.map(err =>
        `${err.instancePath} ${err.message}`
      ) || ['Unknown validation error']
    };
  }
}

export { JSONSchemaType };
