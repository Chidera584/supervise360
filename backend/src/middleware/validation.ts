import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
      return;
    }
    
    next();
  };
};

// Common validation schemas
export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

export const registerSchema = Joi.object({
  first_name: Joi.string().min(2).max(50).required(),
  last_name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('student', 'supervisor', 'admin').required(),
  department: Joi.string().max(100).optional(),
  matric_number: Joi.string().max(50).when('role', {
    is: 'student',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  gpa: Joi.number().min(0).max(5).optional()
});

export const projectSchema = Joi.object({
  title: Joi.string().min(5).max(255).required(),
  description: Joi.string().max(2000).optional(),
  objectives: Joi.string().max(2000).optional(),
  methodology: Joi.string().max(2000).optional(),
  expected_outcomes: Joi.string().max(2000).optional()
});

export const updateProjectSchema = Joi.object({
  title: Joi.string().min(5).max(255).optional(),
  description: Joi.string().max(2000).optional(),
  objectives: Joi.string().max(2000).optional(),
  methodology: Joi.string().max(2000).optional(),
  expected_outcomes: Joi.string().max(2000).optional(),
  status: Joi.string().valid('pending', 'approved', 'rejected', 'in_progress', 'completed').optional(),
  rejection_reason: Joi.string().max(500).optional(),
  progress_percentage: Joi.number().min(0).max(100).optional()
});

export const evaluationSchema = Joi.object({
  project_id: Joi.number().integer().positive().required(),
  evaluation_type: Joi.string().valid('internal', 'external').required(),
  documentation_score: Joi.number().min(0).max(100).optional(),
  implementation_score: Joi.number().min(0).max(100).optional(),
  presentation_score: Joi.number().min(0).max(100).optional(),
  innovation_score: Joi.number().min(0).max(100).optional(),
  feedback: Joi.string().max(2000).optional(),
  strengths: Joi.string().max(1000).optional(),
  weaknesses: Joi.string().max(1000).optional(),
  recommendations: Joi.string().max(1000).optional()
});