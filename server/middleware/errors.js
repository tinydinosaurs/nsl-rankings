/**
 * Comprehensive error handling system for NSL Rankings API
 * Provides consistent error responses and proper HTTP status codes
 */

/**
 * Base API error class with standard properties
 */
class ApiError extends Error {
	constructor(message, statusCode = 500, code = null, details = null) {
		super(message);
		this.name = this.constructor.name;
		this.statusCode = statusCode;
		this.code = code;
		this.details = details;
		this.isOperational = true; // Distinguishes from programming errors
	}

	/**
	 * Convert error to JSON response format
	 */
	toJSON() {
		const response = {
			error: this.message,
		};

		if (this.details) {
			response.details = this.details;
		}

		return response;
	}
}

/**
 * Authentication errors (401)
 */
class AuthenticationError extends ApiError {
	constructor(message = 'Authentication required', details = null) {
		super(message, 401, 'AUTHENTICATION_FAILED', details);
	}
}

/**
 * Authorization errors (403)
 */
class AuthorizationError extends ApiError {
	constructor(message = 'Insufficient permissions', details = null) {
		super(message, 403, 'AUTHORIZATION_FAILED', details);
	}
}

/**
 * Resource not found errors (404)
 */
class NotFoundError extends ApiError {
	constructor(resource = 'Resource', details = null) {
		super(`${resource} not found`, 404, 'RESOURCE_NOT_FOUND', details);
	}
}

/**
 * Validation errors (400)
 */
class ValidationError extends ApiError {
	constructor(message = 'Validation failed', details = null) {
		super(message, 400, 'VALIDATION_FAILED', details);
	}
}

/**
 * Conflict errors (409) - duplicates, constraints, etc.
 */
class ConflictError extends ApiError {
	constructor(message = 'Conflict occurred', details = null) {
		super(message, 409, 'CONFLICT', details);
	}
}

/**
 * Rate limit errors (429)
 */
class RateLimitError extends ApiError {
	constructor(message = 'Rate limit exceeded', details = null) {
		super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
	}
}

/**
 * Database errors (500)
 */
class DatabaseError extends ApiError {
	constructor(message = 'Database operation failed', details = null) {
		super(message, 500, 'DATABASE_ERROR', details);
	}
}

/**
 * File processing errors (422)
 */
class FileProcessingError extends ApiError {
	constructor(message = 'File processing failed', details = null) {
		super(message, 422, 'FILE_PROCESSING_ERROR', details);
	}
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
function asyncHandler(fn) {
	return (req, res, next) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
}

/**
 * Global error handling middleware
 * Must be placed after all routes in Express app
 */
function errorHandler(err, req, res, _next) {
	let error = err;

	// Convert known error types to ApiError instances
	if (err instanceof ValidationError ||
			err instanceof AuthenticationError ||
			err instanceof AuthorizationError ||
			err instanceof NotFoundError ||
			err instanceof ConflictError) {
		// Already proper ApiError instances, use as-is
		error = err;
	} else if (err.name === 'ValidationError' && err.field) {
		// Handle field-specific validation errors (backward compatibility)
		error = new ValidationError('Validation failed', [
			{
				field: err.field,
				message: err.message,
				value: err.value,
			},
		]);
	} else if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
		// Handle SQLite unique constraint violations
		error = new ConflictError('Resource already exists');
	} else if (err.code === 'SQLITE_CONSTRAINT') {
		// Handle other SQLite constraint violations
		error = new ValidationError('Data constraint violation');
	} else if (err.name === 'JsonWebTokenError') {
		// Handle JWT errors
		error = new AuthenticationError('Invalid token');
	} else if (err.name === 'TokenExpiredError') {
		// Handle expired JWT
		error = new AuthenticationError('Token expired');
	} else if (!(err instanceof ApiError)) {
		// Handle unexpected errors
		console.error('Unexpected error:', err);
		error = new ApiError(
			process.env.NODE_ENV === 'production'
				? 'Internal server error'
				: err.message,
			500,
			'INTERNAL_ERROR',
		);
	}

	// Log errors in development
	if (process.env.NODE_ENV !== 'production') {
		console.error(`[${error.statusCode}] ${error.name}: ${error.message}`);
		if (error.details) {
			console.error('Details:', error.details);
		}
		if (err.stack && !(err instanceof ApiError)) {
			console.error(err.stack);
		}
	}

	// Send error response
	res.status(error.statusCode).json(error.toJSON());
}

/**
 * 404 handler for routes that don't exist
 */
function notFoundHandler(req, res, next) {
	const error = new NotFoundError('API endpoint');
	next(error);
}

module.exports = {
	// Error classes
	ApiError,
	AuthenticationError,
	AuthorizationError,
	NotFoundError,
	ValidationError,
	ConflictError,
	RateLimitError,
	DatabaseError,
	FileProcessingError,

	// Middleware functions
	asyncHandler,
	errorHandler,
	notFoundHandler,
};
