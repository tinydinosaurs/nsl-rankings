/**
 * Request validation middleware for NSL Rankings API
 * Provides consistent validation across all endpoints with clear error messages
 */

const { EVENTS } = require('../constants/events');
const { ValidationError } = require('./errors');

/**
 * Legacy ValidationError class for backward compatibility with field-specific errors
 * This will be converted by the global error handler
 */
class FieldValidationError extends Error {
	constructor(field, message, value = null) {
		super(message);
		this.name = 'ValidationError';
		this.field = field;
		this.value = value;
	}
}

/**
 * Validation rule definitions
 */
const validators = {
	// String validators
	required: (value, field) => {
		if (!value || (typeof value === 'string' && value.trim() === '')) {
			throw new FieldValidationError(field, `${field} is required`);
		}
		return value;
	},

	string: (value, field) => {
		if (typeof value !== 'string') {
			throw new FieldValidationError(
				field,
				`${field} must be a string`,
				value,
			);
		}
		return value.trim();
	},

	minLength: (min) => (value, field) => {
		if (value.length < min) {
			throw new FieldValidationError(
				field,
				`${field} must be at least ${min} characters long`,
				value,
			);
		}
		return value;
	},

	maxLength: (max) => (value, field) => {
		if (value.length > max) {
			throw new FieldValidationError(
				field,
				`${field} must be no more than ${max} characters long`,
				value,
			);
		}
		return value;
	},

	// Username validation
	username: (value, field) => {
		if (!/^[a-zA-Z0-9_-]{3,30}$/.test(value)) {
			throw new FieldValidationError(
				field,
				'Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens',
				value,
			);
		}
		return value;
	},

	// Strong password validation
	password: (value, field) => {
		if (value.length < 8) {
			throw new FieldValidationError(
				field,
				'Password must be at least 8 characters long',
			);
		}
		if (!/(?=.*[a-z])/.test(value)) {
			throw new FieldValidationError(
				field,
				'Password must contain at least one lowercase letter',
			);
		}
		if (!/(?=.*[A-Z])/.test(value)) {
			throw new FieldValidationError(
				field,
				'Password must contain at least one uppercase letter',
			);
		}
		if (!/(?=.*\d)/.test(value)) {
			throw new FieldValidationError(
				field,
				'Password must contain at least one number',
			);
		}
		return value;
	},

	// Role validation
	role: (value, field) => {
		const validRoles = ['owner', 'admin', 'user'];
		if (!validRoles.includes(value)) {
			throw new FieldValidationError(
				field,
				`Role must be one of: ${validRoles.join(', ')}`,
				value,
			);
		}
		return value;
	},

	// Number validators
	number: (value, field) => {
		const num = Number(value);
		if (isNaN(num)) {
			throw new FieldValidationError(
				field,
				`${field} must be a valid number`,
				value,
			);
		}
		return num;
	},

	positiveNumber: (value, field) => {
		const num = validators.number(value, field);
		if (num <= 0) {
			throw new FieldValidationError(
				field,
				`${field} must be a positive number`,
				value,
			);
		}
		return num;
	},

	// Date validation
	date: (value, field) => {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			throw new FieldValidationError(
				field,
				`${field} must be in YYYY-MM-DD format`,
				value,
			);
		}
		const date = new Date(value + 'T00:00:00.000Z');
		if (isNaN(date.getTime())) {
			throw new FieldValidationError(
				field,
				`${field} must be a valid date`,
				value,
			);
		}
		return value;
	},

	// Event validation
	event: (value, field) => {
		if (!EVENTS.includes(value)) {
			throw new FieldValidationError(
				field,
				`${field} must be one of: ${EVENTS.join(', ')}`,
				value,
			);
		}
		return value;
	},

	// Array validation
	array: (value, field) => {
		if (!Array.isArray(value)) {
			throw new FieldValidationError(
				field,
				`${field} must be an array`,
				value,
			);
		}
		return value;
	},

	nonEmptyArray: (value, field) => {
		const arr = validators.array(value, field);
		if (arr.length === 0) {
			throw new FieldValidationError(
				field,
				`${field} must not be empty`,
				value,
			);
		}
		return arr;
	},

	// File validation
	file: (value, field) => {
		if (!value) {
			throw new FieldValidationError(field, `${field} is required`);
		}
		return value;
	},

	csvFile: (value, field) => {
		validators.file(value, field);
		if (!value.originalname?.toLowerCase().endsWith('.csv')) {
			throw new FieldValidationError(
				field,
				'File must be a CSV file',
				value.originalname,
			);
		}
		if (value.size > 5 * 1024 * 1024) {
			// 5MB limit
			throw new FieldValidationError(
				field,
				'File size must be less than 5MB',
				`${Math.round(value.size / 1024 / 1024)}MB`,
			);
		}
		return value;
	},
};

/**
 * Apply validation rules to a value
 */
function validateField(value, rules, fieldName) {
	let result = value;

	for (const rule of rules) {
		if (typeof rule === 'function') {
			result = rule(result, fieldName);
		} else if (typeof rule === 'string' && validators[rule]) {
			result = validators[rule](result, fieldName);
		} else {
			throw new Error(`Unknown validation rule: ${rule}`);
		}
	}

	return result;
}

/**
 * Create validation middleware for request body fields
 */
function validateBody(schema) {
	return (req, res, next) => {
		const errors = [];
		const sanitized = {};

		// Validate each field in the schema
		for (const [fieldName, rules] of Object.entries(schema)) {
			try {
				const value = req.body[fieldName];
				sanitized[fieldName] = validateField(value, rules, fieldName);
			} catch (error) {
				if (error instanceof FieldValidationError) {
					errors.push({
						field: error.field,
						message: error.message,
						value: error.value,
					});
				} else {
					throw error;
				}
			}
		}

		if (errors.length > 0) {
			const validationError = new ValidationError('Validation failed', errors);
			return next(validationError);
		}

		// Replace req.body with sanitized values
		req.body = sanitized;
		next();
	};
}

/**
 * Create validation middleware for file uploads
 */
function validateFile(fieldName, rules = []) {
	return (req, res, next) => {
		try {
			const file = req.file || req.files?.[fieldName];
			validateField(file, rules, fieldName);
			next();
		} catch (error) {
			if (error instanceof FieldValidationError) {
				const validationError = new ValidationError('File validation failed', [{
					field: error.field,
					message: error.message,
					value: error.value,
				}]);
				return next(validationError);
			} else {
				return next(error);
			}
		}
	};
}

/**
 * Create validation middleware for query parameters
 */
function validateQuery(schema) {
	return (req, res, next) => {
		const errors = [];
		const sanitized = {};

		for (const [fieldName, rules] of Object.entries(schema)) {
			try {
				const value = req.query[fieldName];
				if (value !== undefined) {
					sanitized[fieldName] = validateField(
						value,
						rules,
						fieldName,
					);
				}
			} catch (error) {
				if (error instanceof FieldValidationError) {
					errors.push({
						field: error.field,
						message: error.message,
						value: error.value,
					});
				} else {
					throw error;
				}
			}
		}

			if (errors.length > 0) {
				const validationError = new ValidationError('Query validation failed', errors);
				return next(validationError);
			}

		// Add sanitized values to req.query
		Object.assign(req.query, sanitized);
		next();
	};
}

module.exports = {
	FieldValidationError,
	validators,
	validateBody,
	validateFile,
	validateQuery,
	validateField,
};
