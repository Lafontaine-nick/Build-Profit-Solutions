const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { loadProjects, saveProjects } = require('../services/leadStorage');

// Middleware to verify JWT token (import from auth routes)
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Load projects from disk on startup
let projects = loadProjects();

// Get all projects (filtered by user)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, client, location } = req.query;
    
    // Reload projects from disk to get latest data
    projects = loadProjects();
    
    // Filter by userId first
    let filteredProjects = projects.filter(p => p.userId === userId);
    
    if (status) {
      filteredProjects = filteredProjects.filter(p => p.status === status);
    }
    
    if (client) {
      filteredProjects = filteredProjects.filter(p => 
        p.client.toLowerCase().includes(client.toLowerCase())
      );
    }
    
    if (location) {
      filteredProjects = filteredProjects.filter(p => 
        p.location.toLowerCase().includes(location.toLowerCase())
      );
    }
    
    res.json({
      success: true,
      data: filteredProjects,
      total: filteredProjects.length,
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch projects',
    });
  }
});

// Get project by ID (must belong to user)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    
    // Reload projects from disk
    projects = loadProjects();
    
    const project = projects.find(p => p.id === id && p.userId === userId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }
    
    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project',
    });
  }
});

// Create new project (associated with user)
router.post('/', authenticateToken, [
  body('name').trim().isLength({ min: 1 }).withMessage('Project name is required'),
  body('client').trim().isLength({ min: 1 }).withMessage('Client name is required'),
  body('location').trim().isLength({ min: 1 }).withMessage('Location is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('totalBudget').isNumeric().withMessage('Total budget must be a number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }
    
    const userId = req.user.userId;
    const {
      name,
      client,
      location,
      startDate,
      endDate,
      totalBudget,
      description,
    } = req.body;
    
    // Reload projects from disk
    projects = loadProjects();
    
    const newProject = {
      id: Date.now().toString(),
      userId, // Associate with user
      name,
      client,
      location,
      startDate,
      endDate,
      totalBudget: parseFloat(totalBudget),
      totalSpent: 0,
      remaining: parseFloat(totalBudget),
      progress: 0,
      status: 'planning',
      description: description || '',
      phases: [],
      budgetItems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    projects.push(newProject);
    saveProjects(projects); // Persist to disk
    
    res.status(201).json({
      success: true,
      data: newProject,
      message: 'Project created successfully',
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create project',
    });
  }
});

// Update project (must belong to user)
router.put('/:id', authenticateToken, [
  body('name').optional().trim().isLength({ min: 1 }),
  body('client').optional().trim().isLength({ min: 1 }),
  body('location').optional().trim().isLength({ min: 1 }),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('totalBudget').optional().isNumeric(),
  body('status').optional().isIn(['planning', 'in-progress', 'completed', 'on-hold', 'cancelled']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }
    
    const userId = req.user.userId;
    const { id } = req.params;
    
    // Reload projects from disk
    projects = loadProjects();
    
    const projectIndex = projects.findIndex(p => p.id === id && p.userId === userId);
    
    if (projectIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }
    
    const updates = req.body;
    updates.updatedAt = new Date().toISOString();
    
    // Recalculate remaining budget if totalBudget changed
    if (updates.totalBudget !== undefined) {
      updates.remaining = updates.totalBudget - projects[projectIndex].totalSpent;
    }
    
    projects[projectIndex] = {
      ...projects[projectIndex],
      ...updates,
    };
    
    saveProjects(projects); // Persist to disk
    
    res.json({
      success: true,
      data: projects[projectIndex],
      message: 'Project updated successfully',
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update project',
    });
  }
});

// Delete project (must belong to user)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    
    // Reload projects from disk
    projects = loadProjects();
    
    const projectIndex = projects.findIndex(p => p.id === id && p.userId === userId);
    
    if (projectIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }
    
    projects.splice(projectIndex, 1);
    saveProjects(projects); // Persist to disk
    
    res.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete project',
    });
  }
});

// Add expense to project (for AI assistant and manual entry)
router.post('/:id/expenses', authenticateToken, [
  body('amount').isNumeric().withMessage('Amount is required'),
  body('category').optional().isString(),
  body('vendor').optional().isString(),
  body('notes').optional().isString(),
  body('date').optional().isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }
    
    const userId = req.user.userId;
    const { id } = req.params;
    
    // Reload projects from disk
    projects = loadProjects();
    
    const projectIndex = projects.findIndex(p => p.id === id && p.userId === userId);
    
    if (projectIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }
    
    const {
      amount,
      category = 'Materials/Equipment',
      vendor = '',
      notes = '',
      date = new Date().toISOString().split('T')[0],
    } = req.body;
    
    const expense = {
      id: `expense-${Date.now()}`,
      category,
      vendor,
      amount: parseFloat(amount),
      date,
      notes,
      createdAt: new Date().toISOString(),
    };
    
    // Initialize expenses array if it doesn't exist
    if (!projects[projectIndex].expenses) {
      projects[projectIndex].expenses = [];
    }
    
    projects[projectIndex].expenses.push(expense);
    
    // Update total spent if it exists
    if (projects[projectIndex].totalSpent !== undefined) {
      projects[projectIndex].totalSpent += expense.amount;
    }
    
    // Update remaining budget if it exists
    if (projects[projectIndex].totalBudget !== undefined && projects[projectIndex].totalSpent !== undefined) {
      projects[projectIndex].remaining = projects[projectIndex].totalBudget - projects[projectIndex].totalSpent;
    }
    
    projects[projectIndex].updatedAt = new Date().toISOString();
    
    saveProjects(projects); // Persist to disk
    
    res.status(201).json({
      success: true,
      data: expense,
      message: 'Expense recorded successfully',
    });
  } catch (error) {
    console.error('Error recording expense:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record expense',
    });
  }
});

// Add budget item to project (must belong to user)
router.post('/:id/budget', authenticateToken, [
  body('category').isIn(['materials', 'labor', 'equipment', 'subcontractors', 'permits', 'other']),
  body('name').trim().isLength({ min: 1 }).withMessage('Item name is required'),
  body('actual').isNumeric().withMessage('Actual amount must be a number'),
  body('budgeted').optional().isNumeric(),
  body('quantity').optional().isNumeric(),
  body('unitPrice').optional().isNumeric(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }
    
    const userId = req.user.userId;
    const { id } = req.params;
    
    // Reload projects from disk
    projects = loadProjects();
    
    const projectIndex = projects.findIndex(p => p.id === id && p.userId === userId);
    
    if (projectIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }
    
    const {
      category,
      name,
      budgeted,
      actual,
      unit,
      quantity,
      unitPrice,
      vendor,
      notes,
    } = req.body;
    
    const budgetItem = {
      id: Date.now().toString(),
      category,
      name,
      budgeted: budgeted || 0,
      actual: parseFloat(actual),
      unit: unit || 'each',
      quantity: quantity || 1,
      unitPrice: unitPrice || 0,
      date: new Date().toISOString().split('T')[0],
      vendor: vendor || '',
      notes: notes || '',
    };
    
    projects[projectIndex].budgetItems.push(budgetItem);
    projects[projectIndex].totalSpent += budgetItem.actual;
    projects[projectIndex].remaining = projects[projectIndex].totalBudget - projects[projectIndex].totalSpent;
    projects[projectIndex].updatedAt = new Date().toISOString();
    
    saveProjects(projects); // Persist to disk
    
    res.status(201).json({
      success: true,
      data: budgetItem,
      message: 'Budget item added successfully',
    });
  } catch (error) {
    console.error('Error adding budget item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add budget item',
    });
  }
});

// Add phase to project (must belong to user)
router.post('/:id/phases', authenticateToken, [
  body('name').trim().isLength({ min: 1 }).withMessage('Phase name is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('budget').optional().isNumeric(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }
    
    const userId = req.user.userId;
    const { id } = req.params;
    
    // Reload projects from disk
    projects = loadProjects();
    
    const projectIndex = projects.findIndex(p => p.id === id && p.userId === userId);
    
    if (projectIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }
    
    const {
      name,
      description,
      startDate,
      endDate,
      budget,
      dependencies,
    } = req.body;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    const phase = {
      id: Date.now().toString(),
      name,
      description: description || '',
      startDate,
      endDate,
      duration,
      progress: 0,
      status: 'not-started',
      dependencies: dependencies || [],
      budget: budget || 0,
      spent: 0,
      tasks: [],
      milestones: [],
    };
    
    projects[projectIndex].phases.push(phase);
    projects[projectIndex].updatedAt = new Date().toISOString();
    
    saveProjects(projects); // Persist to disk
    
    res.status(201).json({
      success: true,
      data: phase,
      message: 'Phase added successfully',
    });
  } catch (error) {
    console.error('Error adding phase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add phase',
    });
  }
});

// Add task to phase (must belong to user)
router.post('/:id/phases/:phaseId/tasks', authenticateToken, [
  body('name').trim().isLength({ min: 1 }).withMessage('Task name is required'),
  body('assignedTo').trim().isLength({ min: 1 }).withMessage('Assigned to is required'),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
  body('estimatedHours').optional().isNumeric(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }
    
    const userId = req.user.userId;
    const { id, phaseId } = req.params;
    
    // Reload projects from disk
    projects = loadProjects();
    
    const projectIndex = projects.findIndex(p => p.id === id && p.userId === userId);
    
    if (projectIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }
    
    const phaseIndex = projects[projectIndex].phases.findIndex(p => p.id === phaseId);
    
    if (phaseIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Phase not found',
      });
    }
    
    const {
      name,
      description,
      assignedTo,
      startDate,
      dueDate,
      priority,
      estimatedHours,
    } = req.body;
    
    const task = {
      id: Date.now().toString(),
      name,
      description: description || '',
      assignedTo,
      startDate: startDate || new Date().toISOString().split('T')[0],
      dueDate,
      status: 'pending',
      priority: priority || 'medium',
      estimatedHours: estimatedHours || 0,
      actualHours: 0,
      progress: 0,
    };
    
    projects[projectIndex].phases[phaseIndex].tasks.push(task);
    projects[projectIndex].updatedAt = new Date().toISOString();
    
    saveProjects(projects); // Persist to disk
    
    res.status(201).json({
      success: true,
      data: task,
      message: 'Task added successfully',
    });
  } catch (error) {
    console.error('Error adding task:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add task',
    });
  }
});

// Update task progress (must belong to user)
router.put('/:id/phases/:phaseId/tasks/:taskId', authenticateToken, [
  body('progress').isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100'),
  body('status').optional().isIn(['pending', 'in-progress', 'completed', 'blocked']),
  body('actualHours').optional().isNumeric(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }
    
    const userId = req.user.userId;
    const { id, phaseId, taskId } = req.params;
    
    // Reload projects from disk
    projects = loadProjects();
    
    const projectIndex = projects.findIndex(p => p.id === id && p.userId === userId);
    
    if (projectIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }
    
    const phaseIndex = projects[projectIndex].phases.findIndex(p => p.id === phaseId);
    
    if (phaseIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Phase not found',
      });
    }
    
    const taskIndex = projects[projectIndex].phases[phaseIndex].tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }
    
    const updates = req.body;
    projects[projectIndex].phases[phaseIndex].tasks[taskIndex] = {
      ...projects[projectIndex].phases[phaseIndex].tasks[taskIndex],
      ...updates,
    };
    
    // Update phase progress based on task progress
    const tasks = projects[projectIndex].phases[phaseIndex].tasks;
    const totalProgress = tasks.reduce((sum, task) => sum + task.progress, 0);
    const phaseProgress = Math.round(totalProgress / tasks.length);
    
    projects[projectIndex].phases[phaseIndex].progress = phaseProgress;
    projects[projectIndex].phases[phaseIndex].status = 
      phaseProgress === 100 ? 'completed' : phaseProgress > 0 ? 'in-progress' : 'not-started';
    
    // Update overall project progress
    const phases = projects[projectIndex].phases;
    if (phases.length > 0) {
      const totalPhaseProgress = phases.reduce((sum, phase) => sum + phase.progress, 0);
      projects[projectIndex].progress = Math.round(totalPhaseProgress / phases.length);
    }
    
    projects[projectIndex].updatedAt = new Date().toISOString();
    
    saveProjects(projects); // Persist to disk
    
    res.json({
      success: true,
      data: projects[projectIndex].phases[phaseIndex].tasks[taskIndex],
      message: 'Task updated successfully',
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update task',
    });
  }
});

// Get project analytics (must belong to user)
router.get('/:id/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    
    // Reload projects from disk
    projects = loadProjects();
    
    const project = projects.find(p => p.id === id && p.userId === userId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }
    
    // Calculate analytics
    const totalTasks = project.phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
    const completedTasks = project.phases.reduce((sum, phase) => 
      sum + phase.tasks.filter(task => task.status === 'completed').length, 0
    );
    const inProgressTasks = project.phases.reduce((sum, phase) => 
      sum + phase.tasks.filter(task => task.status === 'in-progress').length, 0
    );
    
    const totalBudgetItems = project.budgetItems.length;
    const overBudgetItems = project.budgetItems.filter(item => item.actual > item.budgeted).length;
    
    const budgetVariance = project.totalBudget - project.totalSpent;
    const budgetVariancePercentage = project.totalBudget > 0 ? 
      (budgetVariance / project.totalBudget) * 100 : 0;
    
    const analytics = {
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        progress: project.progress,
        startDate: project.startDate,
        endDate: project.endDate,
        totalBudget: project.totalBudget,
        totalSpent: project.totalSpent,
        remaining: project.remaining,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        pending: totalTasks - completedTasks - inProgressTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      },
      budget: {
        totalItems: totalBudgetItems,
        overBudgetItems,
        variance: budgetVariance,
        variancePercentage: budgetVariancePercentage,
        categories: {
          materials: project.budgetItems.filter(item => item.category === 'materials'),
          labor: project.budgetItems.filter(item => item.category === 'labor'),
          equipment: project.budgetItems.filter(item => item.category === 'equipment'),
          subcontractors: project.budgetItems.filter(item => item.category === 'subcontractors'),
          permits: project.budgetItems.filter(item => item.category === 'permits'),
          other: project.budgetItems.filter(item => item.category === 'other'),
        },
      },
      phases: project.phases.map(phase => ({
        id: phase.id,
        name: phase.name,
        status: phase.status,
        progress: phase.progress,
        budget: phase.budget,
        spent: phase.spent,
        taskCount: phase.tasks.length,
        completedTasks: phase.tasks.filter(task => task.status === 'completed').length,
      })),
    };
    
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error fetching project analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project analytics',
    });
  }
});

module.exports = router;
