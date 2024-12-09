import slugify from 'slugify';
import isURL from 'validator/lib/isURL.js';
import isEmail from 'validator/lib/isEmail.js';

export class ValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

export const validators = {
  required: (value, field) => {
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`${field} is required`, field, value);
    }
    return value;
  },

  hexColor: (value, field) => {
    if (value && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) {
      throw new ValidationError(
        `${field} must be a valid hex color code (e.g., #FF0000)`,
        field,
        value
      );
    }
    return value;
  },

  generateSlug: (value, field) => {
    if (!value) {
      throw new ValidationError(`Cannot generate slug: ${field} is empty`, field, value);
    }
    return {
      _type: 'slug',
      current: slugify(value, { lower: true, strict: true })
    };
  },

  email: (value, field) => {
    if (value && !isEmail(value)) {
      throw new ValidationError(
        `${field} must be a valid email address`,
        field,
        value
      );
    }
    return value;
  },

  url: (value, field) => {
    if (value && !isURL(value, { require_protocol: true })) {
      throw new ValidationError(
        `${field} must be a valid URL with protocol (http:// or https://)`,
        field,
        value
      );
    }
    return value;
  },

  array: (value, field) => {
    if (value && !Array.isArray(value)) {
      throw new ValidationError(
        `${field} must be an array`,
        field,
        value
      );
    }
    return value || [];
  }
}; 