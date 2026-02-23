import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ----- Project service - returns action data for mobile app to process -----
const ProjectService = {
  async recordMaterialPurchase(args: {
    project_name: string;
    amount: number;
    vendor: string;
    category: string;
    notes?: string;
    context?: string;
  }) {
    console.log("Recording material purchase:", args);

    // Parse context to find the correct project
    let actualProjectName = args.project_name;
    let projectId: string | undefined;
    let projectBudget = 0;
    let projectSpent = 0;
    
    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        
        // Search through all projects to find a match
        if (context.allProjects && Array.isArray(context.allProjects)) {
          const searchName = args.project_name.toLowerCase().trim();
          
          // First, try exact match (most strict)
          let matchingProject = context.allProjects.find((p: any) => {
            const title = (p.title || '').toLowerCase().trim();
            const customer = (p.customerName || '').toLowerCase().trim();
            return title === searchName || customer === searchName;
          });
          
          // If no exact match, try contains match (but exclude current bid if it doesn't match)
          if (!matchingProject) {
            matchingProject = context.allProjects.find((p: any) => {
              const title = (p.title || '').toLowerCase().trim();
              const customer = (p.customerName || '').toLowerCase().trim();
              
              // Don't match the current bid unless it actually matches
              if (context.bidTitle && title === context.bidTitle.toLowerCase().trim()) {
                return false; // Skip current bid
              }
              
              return title.includes(searchName) || 
                     searchName.includes(title) ||
                     customer.includes(searchName) ||
                     searchName.includes(customer);
            });
          }
          
          if (matchingProject) {
            actualProjectName = matchingProject.title;
            projectId = matchingProject.id;
            const projectStatus = (matchingProject.status || '').toLowerCase();
            
            // CRITICAL: Check if this is an estimate (should use update_estimate_item, not record_material_purchase)
            const isEstimate = ['draft', 'estimate', 'submitted', 'bid_submitted'].includes(projectStatus);
            if (isEstimate) {
              console.log(`⚠️ Project "${actualProjectName}" is an ESTIMATE (status: ${projectStatus}). record_material_purchase should NOT be used for estimates.`);
              console.log(`💡 Suggestion: Use update_estimate_item instead for estimates.`);
            }
            
            // Get the project's actual budget and spent amounts
            projectBudget = matchingProject.bidPrice || matchingProject.estimatedCost || 0;
            projectSpent = matchingProject.actualCost || 0;
            console.log(`✅ Found matching project: ${actualProjectName} (ID: ${projectId}, status: ${projectStatus}) for search "${args.project_name}"`);
            console.log(`📊 Project budget: $${projectBudget}, already spent: $${projectSpent}`);
          } else {
            console.log(`⚠️ No matching project found for "${args.project_name}". Available projects:`, 
              context.allProjects.map((p: any) => p.title));
          }
        }
        
        // Fallback to current bid if no match found
        if (!projectId && context.bidTitle) {
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            actualProjectName = context.bidTitle;
            projectBudget = context.bidTotal || 0;
            console.log(`⚠️ Using current bid as fallback: ${actualProjectName}`);
          }
        }
      } catch (e) {
        console.error("Error parsing context:", e);
        // Context parsing failed, use provided project_name
      }
    }

    // Calculate remaining budget using the CORRECT project's budget
    const newSpent = projectSpent + args.amount;
    const remainingBudget = projectBudget > 0 ? projectBudget - newSpent : undefined;

    // Return structured data for mobile app to process
    // The mobile app will handle the actual data update
    return {
      projectName: actualProjectName,
      projectId: projectId, // Include project ID if found
      amount: args.amount,
      vendor: args.vendor,
      category: args.category,
      notes: args.notes,
      // Include budget info for AI to use in response
      projectBudget: projectBudget,
      projectSpent: projectSpent,
      newSpent: newSpent,
      estimatedRemainingBudget: remainingBudget,
    };
  },

  // Helper function to find project by name
  findProject(context: any, projectName: string): { project: any; projectId: string | undefined; projectBudget: number; projectSpent: number } | null {
    if (!context.allProjects || !Array.isArray(context.allProjects)) {
      return null;
    }

    const searchName = projectName.toLowerCase().trim();
    
    // First, try exact match
    let matchingProject = context.allProjects.find((p: any) => {
      const title = (p.title || '').toLowerCase().trim();
      const customer = (p.customerName || '').toLowerCase().trim();
      return title === searchName || customer === searchName;
    });
    
    // If no exact match, try contains match
    if (!matchingProject) {
      matchingProject = context.allProjects.find((p: any) => {
        const title = (p.title || '').toLowerCase().trim();
        const customer = (p.customerName || '').toLowerCase().trim();
        
        if (context.bidTitle && title === context.bidTitle.toLowerCase().trim()) {
          return false;
        }
        
        return title.includes(searchName) || 
               searchName.includes(title) ||
               customer.includes(searchName) ||
               searchName.includes(customer);
      });
    }
    
    if (matchingProject) {
      // Use totalBudget or estimatedCost (includes change orders) as the current budget
      // bidPrice is the original budget before change orders
      const currentBudget = matchingProject.totalBudget || 
                            matchingProject.estimatedCost || 
                            matchingProject.bidPrice || 
                            0;
      
      return {
        project: matchingProject,
        projectId: matchingProject.id,
        projectBudget: currentBudget, // Use current total budget (includes approved change orders)
        projectSpent: matchingProject.actualCost || 0,
      };
    }
    
    return null;
  },

  async recordLaborExpense(args: {
    project_name: string;
    amount: number;
    labor_type?: string;
    hours?: number;
    rate?: number;
    vendor?: string;
    notes?: string;
    context?: string;
  }) {
    console.log("Recording labor expense:", args);

    let actualProjectName = args.project_name;
    let projectId: string | undefined;
    let projectBudget = 0;
    let projectSpent = 0;
    
    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        const found = this.findProject(context, args.project_name);
        
        if (found) {
          actualProjectName = found.project.title;
          projectId = found.projectId;
          projectBudget = found.projectBudget;
          projectSpent = found.projectSpent;
          console.log(`✅ Found matching project: ${actualProjectName} (ID: ${projectId})`);
        } else if (context.bidTitle) {
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            actualProjectName = context.bidTitle;
            projectBudget = context.bidTotal || 0;
            console.log(`⚠️ Using current bid as fallback: ${actualProjectName}`);
          }
        }
      } catch (e) {
        console.error("Error parsing context:", e);
      }
    }

    const newSpent = projectSpent + args.amount;
    const remainingBudget = projectBudget > 0 ? projectBudget - newSpent : undefined;

    return {
      projectName: actualProjectName,
      projectId: projectId,
      amount: args.amount,
      laborType: args.labor_type || 'Labor',
      hours: args.hours,
      rate: args.rate,
      vendor: args.vendor || 'Internal',
      notes: args.notes,
      projectBudget: projectBudget,
      projectSpent: projectSpent,
      newSpent: newSpent,
      estimatedRemainingBudget: remainingBudget,
    };
  },

  async createChangeOrder(args: {
    project_name: string;
    title: string;
    amount: number;
    approved?: boolean;
    notes?: string;
    materialsAmount?: number;
    laborAmount?: number;
    context?: string;
  }) {
    console.log("Creating change order:", args);

    let actualProjectName = args.project_name;
    let projectId: string | undefined;
    let projectBudget = 0;
    let projectStatus: string | undefined;
    
    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        const found = this.findProject(context, args.project_name);
        
        if (found) {
          actualProjectName = found.project.title;
          projectId = found.projectId;
          projectBudget = found.projectBudget;
          projectStatus = found.project.status;
          console.log(`✅ Found matching project: ${actualProjectName} (ID: ${projectId}, Status: ${projectStatus})`);
          
          // CRITICAL: Check if this is a draft/estimate project - change orders are ONLY for won/active/completed projects
          const isDraftEstimate = !projectStatus || 
                                  projectStatus === 'estimate' || 
                                  projectStatus === 'draft' || 
                                  projectStatus === 'submitted' ||
                                  projectStatus === 'bid_submitted';
          
          if (isDraftEstimate) {
            return {
              error: "INVALID_STATUS",
              message: `Cannot create a change order for "${actualProjectName}" because it is a draft/estimate project (status: ${projectStatus || 'estimate'}). Change orders are only for projects that have been won or are active. For draft/estimate projects, use 'update_estimate_item' to add materials or labor to the estimate.`,
              projectName: actualProjectName,
              projectId: projectId,
              projectStatus: projectStatus,
            };
          }
        } else if (context.bidTitle) {
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            actualProjectName = context.bidTitle;
            projectBudget = context.bidTotal || 0;
            // If we're using the current bid, it's definitely a draft/estimate
            return {
              error: "INVALID_STATUS",
              message: `Cannot create a change order for "${actualProjectName}" because it is a draft/estimate (current bid in Estimate Generator). Change orders are only for projects that have been won or are active. Use 'update_estimate_item' to add materials or labor to the estimate.`,
              projectName: actualProjectName,
            };
          }
        }
      } catch (e) {
        console.error("Error parsing context:", e);
      }
    }

    // If approved, the new budget is current budget + change order amount
    // If not approved, the budget stays the same (change order is pending)
    const newBudget = args.approved ? projectBudget + args.amount : projectBudget;

    return {
      projectName: actualProjectName,
      projectId: projectId,
      title: args.title,
      amount: args.amount,
      approved: args.approved || false,
      notes: args.notes,
      materialsAmount: args.materialsAmount,
      laborAmount: args.laborAmount,
      projectBudget: projectBudget, // Current total budget (includes approved change orders)
      newBudget: newBudget, // New budget if this change order is approved
    };
  },

  async createNewBid(args: {
    title: string;
    customer_name: string;
    location?: string;
    project_type?: string;
    sqft?: number;
    context?: string;
  }) {
    console.log("Creating new bid:", args);

    // Generate a unique ID for the new bid
    const bidId = `bid-${Date.now()}`;

    return {
      bidId: bidId,
      title: args.title,
      customerName: args.customer_name,
      location: args.location || 'Unknown',
      projectType: args.project_type || 'kitchen',
      sqft: args.sqft || 0,
      message: `New bid "${args.title}" has been created. You can now add materials, labor, and other costs to build your estimate.`,
    };
  },

  async createPurchaseOrder(args: {
    project_name: string;
    vendor: string;
    category: string;
    amount: number;
    description?: string;
    expectedDelivery?: string;
    notes?: string;
    context?: string;
  }) {
    console.log("Creating purchase order:", args);

    let actualProjectName = args.project_name;
    let projectId: string | undefined;
    
    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        const found = this.findProject(context, args.project_name);
        
        if (found) {
          actualProjectName = found.project.title;
          projectId = found.projectId;
          console.log(`✅ Found matching project: ${actualProjectName} (ID: ${projectId})`);
        } else if (context.bidTitle) {
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            actualProjectName = context.bidTitle;
            console.log(`⚠️ Using current bid as fallback: ${actualProjectName}`);
          }
        }
      } catch (e) {
        console.error("Error parsing context:", e);
      }
    }

    // Generate PO number
    const poNumber = `PO-${Date.now().toString().slice(-6)}`;

    return {
      projectName: actualProjectName,
      projectId: projectId,
      poNumber: poNumber,
      vendor: args.vendor,
      category: args.category,
      amount: args.amount,
      description: args.description,
      expectedDelivery: args.expectedDelivery,
      notes: args.notes,
    };
  },

  async approveChangeOrder(args: {
    project_name: string;
    change_order_title?: string;
    change_order_id?: string;
    context?: string;
  }) {
    console.log("Approving change order:", args);

    let actualProjectName = args.project_name;
    let projectId: string | undefined;
    
    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        const found = this.findProject(context, args.project_name);
        
        if (found) {
          actualProjectName = found.project.title;
          projectId = found.projectId;
          console.log(`✅ Found matching project: ${actualProjectName} (ID: ${projectId})`);
        } else if (context.bidTitle) {
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            actualProjectName = context.bidTitle;
            console.log(`⚠️ Using current bid as fallback: ${actualProjectName}`);
          }
        }
      } catch (e) {
        console.error("Error parsing context:", e);
      }
    }

    return {
      projectName: actualProjectName,
      projectId: projectId,
      changeOrderTitle: args.change_order_title,
      changeOrderId: args.change_order_id,
    };
  },

  async updateTimelineMilestone(args: {
    project_name: string;
    milestone_name: string;
    new_status?: string;
    progress_pct?: number;
    planned_date?: string;
    notes?: string;
    context?: string;
  }) {
    console.log("Updating timeline milestone:", args);

    let actualProjectName = args.project_name;
    let projectId: string | undefined;

    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        const found = this.findProject(context, args.project_name);

        if (found) {
          actualProjectName = found.project.title;
          projectId = found.projectId;
          console.log(`✅ Found matching project: ${actualProjectName} (ID: ${projectId})`);
        } else if (context.bidTitle) {
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            actualProjectName = context.bidTitle;
            console.log(`⚠️ Using current bid as fallback: ${actualProjectName}`);
          }
        }
      } catch (e) {
        console.error("Error parsing context:", e);
      }
    }

    return {
      projectName: actualProjectName,
      projectId,
      milestoneName: args.milestone_name,
      newStatus: args.new_status,
      progressPct: args.progress_pct,
      plannedDate: args.planned_date,
      notes: args.notes,
    };
  },

  async suggestMissingCosts(args: {
    project_name: string;
    context?: string;
  }) {
    console.log("Suggesting missing costs:", args);

    let actualProjectName = args.project_name;
    let projectId: string | undefined;
    let project: any = null;

    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        const found = this.findProject(context, args.project_name);

        if (found) {
          actualProjectName = found.project.title;
          projectId = found.projectId;
          project = found.project;
          console.log(`✅ Found matching project: ${actualProjectName} (ID: ${projectId})`);
        } else if (context.bidTitle) {
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            actualProjectName = context.bidTitle;
            project = {
              title: context.bidTitle,
              estimateData: context.bidData || {},
            };
            console.log(`⚠️ Using current bid as fallback: ${actualProjectName}`);
          }
        }
      } catch (e) {
        console.error("Error parsing context:", e);
      }
    }

    return {
      projectName: actualProjectName,
      projectId,
      projectData: project,
    };
  },

  async getRecentProjects(args: {
    context?: string;
    limit?: number;
  }) {
    console.log("Getting recent projects:", args);
    
    const limit = args.limit || 10;
    let projects: any[] = [];

    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        
        if (context.allProjects && Array.isArray(context.allProjects)) {
          // Get all projects and sort by activity/recency
          projects = context.allProjects
            .map((p: any) => ({
              id: p.id || String(p.projectId || ''),
              title: p.title || p.name || 'Untitled Project',
              status: p.status || 'unknown',
              customerName: p.customerName || p.client || '',
              bidPrice: p.bidPrice || p.estimatedCost || 0,
              actualCost: p.actualCost || p.spent || 0,
              lastOpened: p.lastOpened || p.updatedAt || p.createdAt,
              isActive: ['active', 'won', 'in_progress', 'submitted'].includes(
                (p.status || '').toLowerCase()
              ),
            }))
            .sort((a, b) => {
              // Sort by: active first, then by last opened
              if (a.isActive && !b.isActive) return -1;
              if (!a.isActive && b.isActive) return 1;
              
              const dateA = new Date(a.lastOpened || 0).getTime();
              const dateB = new Date(b.lastOpened || 0).getTime();
              return dateB - dateA;
            })
            .slice(0, limit);
          
          console.log(`✅ Found ${projects.length} recent projects`);
        } else {
          console.log("⚠️ No allProjects in context");
        }
      } catch (e) {
        console.error("Error parsing context:", e);
      }
    }

    return {
      projects,
      count: projects.length,
    };
  },

  async getProjectSnapshot(args: {
    project_id: string;
    context?: string;
  }) {
    console.log("Getting project snapshot:", args);

    let project: any = null;
    let error: string | null = null;

    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        
        if (context.allProjects && Array.isArray(context.allProjects)) {
          // Find project by ID
          project = context.allProjects.find((p: any) => 
            String(p.id || p.projectId || '') === String(args.project_id)
          );
          
          if (project) {
            // Return full project snapshot with all relevant data
            project = {
              id: project.id || project.projectId,
              title: project.title || project.name,
              customerName: project.customerName || project.client,
              status: project.status,
              bidPrice: project.bidPrice || project.estimatedCost || 0,
              actualCost: project.actualCost || project.spent || 0,
              budgeted: project.budgeted || project.bidPrice || 0,
              estimatedCost: project.estimatedCost || 0,
              margin: project.margin || 0,
              markup: project.markup || project.markupPct || 0,
              overhead: project.overhead || 0,
              progress: project.progress || project.overallProgressPct || 0,
              location: project.location || '',
              startDate: project.startDate,
              endDate: project.endDate,
              buckets: project.buckets || [],
              expenses: project.expenses || [],
              purchaseOrders: project.purchaseOrders || [],
              changeOrders: project.changeOrders || [],
              milestones: project.milestones || [],
              notes: project.notes || [],
              lastOpened: project.lastOpened || project.updatedAt || project.createdAt,
            };
            
            console.log(`✅ Found project snapshot: ${project.title} (ID: ${project.id})`);
          } else {
            error = `Project with ID '${args.project_id}' not found.`;
            console.log(`❌ Project not found: ID "${args.project_id}"`);
          }
        } else {
          error = "No project data available in context.";
        }
      } catch (e) {
        console.error("Error parsing context:", e);
        error = "Error parsing project context. Please try again.";
      }
    } else {
      error = "No project context provided. Cannot get project snapshot.";
    }

    return {
      projectId: args.project_id,
      projectData: project,
      error: error || undefined,
    };
  },

  async summarizeProject(args: {
    project_name: string;
    context?: string;
  }) {
    console.log("Summarizing project:", args);

    let actualProjectName = args.project_name;
    let projectId: string | undefined;
    let project: any = null;
    let error: string | null = null;

    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        const found = this.findProject(context, args.project_name);

        if (found) {
          actualProjectName = found.project.title;
          projectId = found.projectId;
          project = found.project;
          console.log(`✅ Found matching project: ${actualProjectName} (ID: ${projectId})`);
        } else {
          // Project not found - return error instead of null project
          const availableProjects = context.allProjects?.map((p: any) => p.title || p.name).filter(Boolean) || [];
          error = `Project '${args.project_name}' not found. Available projects: ${availableProjects.length > 0 ? availableProjects.join(', ') : 'none'}. Please make sure the project exists and the name is correct.`;
          console.log(`❌ Project not found: "${args.project_name}". Available: ${availableProjects.join(', ')}`);
        }
      } catch (e) {
        console.error("Error parsing context:", e);
        error = "Error parsing project context. Please try again.";
      }
    } else {
      error = "No project context provided. Cannot summarize project.";
    }

    return {
      projectName: actualProjectName,
      projectId,
      projectData: project,
      error: error || undefined,
    };
  },

  async calculateProjectProfitability(args: {
    project_name: string;
    context?: string;
  }) {
    console.log("Calculating project profitability:", args);

    let actualProjectName = args.project_name;
    let projectId: string | undefined;
    let project: any = null;

    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        const found = this.findProject(context, args.project_name);

        if (found) {
          actualProjectName = found.project.title;
          projectId = found.projectId;
          project = found.project;
          console.log(`✅ Found matching project: ${actualProjectName} (ID: ${projectId})`);
        }
      } catch (e) {
        console.error("Error parsing context:", e);
      }
    }

    return {
      projectName: actualProjectName,
      projectId,
      projectData: project,
    };
  },

  async identifyProjectRisks(args: {
    project_name: string;
    context?: string;
  }) {
    console.log("Identifying project risks:", args);

    let actualProjectName = args.project_name;
    let projectId: string | undefined;
    let project: any = null;

    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        const found = this.findProject(context, args.project_name);

        if (found) {
          actualProjectName = found.project.title;
          projectId = found.projectId;
          project = found.project;
          console.log(`✅ Found matching project: ${actualProjectName} (ID: ${projectId})`);
        }
      } catch (e) {
        console.error("Error parsing context:", e);
      }
    }

    return {
      projectName: actualProjectName,
      projectId,
      projectData: project,
    };
  },

  async addProjectNote(args: {
    project_name: string;
    note: string;
    note_type?: string;
    context?: string;
  }) {
    console.log("Adding project note:", args);

    let actualProjectName = args.project_name;
    let projectId: string | undefined;

    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        const found = this.findProject(context, args.project_name);

        if (found) {
          actualProjectName = found.project.title;
          projectId = found.projectId;
          console.log(`✅ Found matching project: ${actualProjectName} (ID: ${projectId})`);
        }
      } catch (e) {
        console.error("Error parsing context:", e);
      }
    }

    return {
      projectName: actualProjectName,
      projectId,
      note: args.note,
      noteType: args.note_type || 'general',
      timestamp: new Date().toISOString(),
    };
  },

  async updateProjectDetails(args: {
    project_name: string;
    budget_range?: string;
    scope_description?: string;
    start_date?: string;
    end_date?: string;
    context?: string;
  }) {
    console.log("Updating project details:", args);

    let actualProjectName = args.project_name;
    let projectId: string | undefined;
    let project: any = null;

    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        const found = this.findProject(context, args.project_name);

        if (found) {
          actualProjectName = found.project.title;
          projectId = found.projectId;
          project = found.project;
          console.log(`✅ Found matching project: ${actualProjectName} (ID: ${projectId})`);
        } else if (context.bidTitle) {
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            actualProjectName = context.bidTitle;
            project = {
              title: context.bidTitle,
              estimateData: context.bidData || {},
            };
            console.log(`⚠️ Using current bid as fallback: ${actualProjectName}`);
          }
        }
      } catch (e) {
        console.error("Error parsing context:", e);
      }
    }

    return {
      projectName: actualProjectName,
      projectId,
      budgetRange: args.budget_range,
      scopeDescription: args.scope_description,
      startDate: args.start_date,
      endDate: args.end_date,
      projectData: project,
    };
  },

  async updateCustomerInfo(args: {
    project_name: string;
    customer_name?: string;
    email?: string;
    phone?: string;
    company?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    notes?: string;
    context?: string;
  }) {
    console.log("Updating customer information:", args);

    let actualProjectName = args.project_name;
    let projectId: string | undefined;
    let project: any = null;

    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        const found = this.findProject(context, args.project_name);

        if (found) {
          actualProjectName = found.project.title;
          projectId = found.projectId;
          project = found.project;
          console.log(`✅ Found matching project: ${actualProjectName} (ID: ${projectId})`);
        } else if (context.bidTitle) {
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            actualProjectName = context.bidTitle;
            project = {
              title: context.bidTitle,
              estimateData: context.bidData || {},
            };
            console.log(`⚠️ Using current bid as fallback: ${actualProjectName}`);
          }
        }
      } catch (e) {
        console.error("Error parsing context:", e);
      }
    }

    return {
      projectName: actualProjectName,
      projectId,
      customerName: args.customer_name,
      email: args.email,
      phone: args.phone,
      company: args.company,
      address: args.address,
      city: args.city,
      state: args.state,
      zip: args.zip,
      notes: args.notes,
      projectData: project,
    };
  },

  async updateEstimateItem(args: {
    project_name: string;
    item_description?: string;
    item_id?: string;
    new_amount?: number;
    new_quantity?: number;
    new_unit_cost?: number;
    new_description?: string;
    project_scope?: string;
    context?: string;
  }) {
    console.log("Updating estimate item:", args);

    let actualProjectName = args.project_name;
    let projectId: string | undefined;
    let project: any = null;

    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        const found = this.findProject(context, args.project_name);

        if (found) {
          actualProjectName = found.project.title;
          projectId = found.projectId;
          project = found.project;
          console.log(`✅ Found matching project: ${actualProjectName} (ID: ${projectId})`);
        } else if (context.bidTitle) {
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            actualProjectName = context.bidTitle;
            project = {
              title: context.bidTitle,
              estimateData: context.bidData || {},
            };
            console.log(`⚠️ Using current bid as fallback: ${actualProjectName}`);
          }
        }
      } catch (e) {
        console.error("Error parsing context:", e);
      }
    }

    return {
      projectName: actualProjectName,
      projectId,
      itemDescription: args.item_description,
      itemId: args.item_id,
      newAmount: args.new_amount,
      newQuantity: args.new_quantity,
      newUnitCost: args.new_unit_cost,
      newDescription: args.new_description,
      projectScope: args.project_scope,
      projectData: project,
    };
  },

  async searchMaterialPrices(args: {
    material: string;
    zip_code?: string;
    store?: string; // 'hd', 'lowes', or 'both' (default: 'both')
    context?: string;
  }) {
    console.log("Searching material prices:", args);

    const material = args.material;
    const zip = args.zip_code || '89011'; // Default ZIP if not provided
    const store = args.store || 'both'; // Default to both stores for comparison

    // Extract ZIP from context if available
    let actualZip = zip;
    if (args.context && !zip) {
      try {
        const context = JSON.parse(args.context);
        if (context.bidData?.customerZip) {
          actualZip = context.bidData.customerZip;
        } else if (context.customerZip) {
          actualZip = context.customerZip;
        }
      } catch (e) {
        console.error("Error parsing context for ZIP:", e);
      }
    }

    const results: any = {
      material,
      zip: actualZip,
      stores: {},
    };

    try {
      // Search Home Depot if requested
      if (store === 'hd' || store === 'both') {
        try {
          const hdResponse = await axios.get(`http://localhost:3001/api/sku/search`, {
            params: {
              store: 'hd',
              zip: actualZip,
              q: material,
            },
          });
          if (hdResponse.status === 200) {
            const hdData = hdResponse.data;
            results.stores.homedepot = {
              name: 'Home Depot',
              results: hdData.results || [],
              topResult: hdData.results?.[0] || null,
              isMockData: hdData.metadata?.isMockData || false,
            };
          }
        } catch (error) {
          console.error('Home Depot search failed:', error);
          results.stores.homedepot = { name: 'Home Depot', error: 'Search failed' };
        }
      }

      // Search Lowe's if requested
      if (store === 'lowes' || store === 'both') {
        try {
          const lowesResponse = await axios.get(`http://localhost:3001/api/sku/search`, {
            params: {
              store: 'lowes',
              zip: actualZip,
              q: material,
            },
          });
          if (lowesResponse.status === 200) {
            const lowesData = lowesResponse.data;
            results.stores.lowes = {
              name: 'Lowe\'s',
              results: lowesData.results || [],
              topResult: lowesData.results?.[0] || null,
              isMockData: lowesData.metadata?.isMockData || false,
            };
          }
        } catch (error) {
          console.error('Lowe\'s search failed:', error);
          results.stores.lowes = { name: 'Lowe\'s', error: 'Search failed' };
        }
      }

      // Compare prices if both stores searched
      if (store === 'both' && results.stores.homedepot?.topResult && results.stores.lowes?.topResult) {
        const hdPrice = results.stores.homedepot.topResult.price;
        const lowesPrice = results.stores.lowes.topResult.price;
        
        if (hdPrice && lowesPrice) {
          results.comparison = {
            cheaperStore: hdPrice < lowesPrice ? 'Home Depot' : 'Lowe\'s',
            cheaperPrice: Math.min(hdPrice, lowesPrice),
            moreExpensivePrice: Math.max(hdPrice, lowesPrice),
            priceDifference: Math.abs(hdPrice - lowesPrice),
            savingsPercent: ((Math.abs(hdPrice - lowesPrice) / Math.max(hdPrice, lowesPrice)) * 100).toFixed(1),
          };
        }
      }

    } catch (error) {
      console.error('Price search error:', error);
      return {
        material,
        zip: actualZip,
        error: error instanceof Error ? error.message : 'Search failed',
      };
    }

    return results;
  },

  async searchContractors(args: {
    trade: string;
    location?: string;
    zip_code?: string;
    context?: string;
  }) {
    console.log("Searching for contractors:", args);

    const trade = args.trade.toLowerCase();
    const location = args.location || '';
    const zip = args.zip_code || '89011'; // Default ZIP if not provided

    // Extract location from context if available
    let actualLocation = location;
    let actualZip = zip;
    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        if (context.location) {
          actualLocation = context.location;
        } else if (context.bidData?.customerLocation) {
          actualLocation = context.bidData.customerLocation;
        } else if (context.customerCity && context.customerState) {
          actualLocation = `${context.customerCity}, ${context.customerState}`;
        }
        if (context.bidData?.customerZip) {
          actualZip = context.bidData.customerZip;
        } else if (context.customerZip) {
          actualZip = context.customerZip;
        }
      } catch (e) {
        console.error("Error parsing context for location:", e);
      }
    }

    // Use ZIP code for location if no location string provided
    const searchLocation = actualLocation || actualZip;

    // Map trade types to Yelp search terms
    const tradeMap: Record<string, string> = {
      'plumbing': 'plumber',
      'electrical': 'electrician',
      'hvac': 'hvac contractor',
      'framing': 'framing contractor',
      'tile': 'tile contractor',
      'drywall': 'drywall contractor',
      'roofing': 'roofer',
      'painting': 'painter',
      'concrete': 'concrete contractor',
      'general': 'general contractor',
      'contractor': 'contractor',
    };

    const searchTerm = tradeMap[trade] || trade;

    const allContractors: any[] = [];

    try {
      // 1. Search Yelp API for contractors
      try {
        const yelpResponse = await axios.get(`http://localhost:3001/api/yelp/search`, {
          params: {
            term: searchTerm,
            location: searchLocation,
            categories: 'contractors',
            limit: 10,
            sort_by: 'rating', // Sort by rating to get top-rated first
          },
        });

        if (yelpResponse.status === 200) {
          const businesses = yelpResponse.data.businesses || [];
          
          // Convert Yelp businesses to contractor format
          const yelpContractors = businesses.map((b: any) => ({
            name: b.name,
            rating: b.rating,
            reviewCount: b.review_count || 0,
            phone: b.phone,
            address: b.location?.address1 || '',
            city: b.location?.city || '',
            state: b.location?.state || '',
            zip: b.location?.zip_code || '',
            distance: b.distance ? `${(b.distance / 1609.34).toFixed(1)} mi` : null,
            url: b.url,
            price: b.price || null,
            categories: b.categories?.map((c: any) => c.title) || [],
            source: 'yelp',
            sourceLabel: 'Yelp',
            isMockData: yelpResponse.data.metadata?.isMockData || false,
          }));

          allContractors.push(...yelpContractors);
        }
      } catch (yelpError) {
        console.warn('Yelp search failed:', yelpError);
      }

      // 2. Fetch campaigns (subcontractors with lead campaigns) from backend
      try {
        // Fetch campaign leads from unified leads service
        // Campaigns are identified by projectId starting with 'CAMPAIGN-'
        const unifiedLeadsResponse = await axios.get(`http://localhost:3001/api/unified-leads/contractor/unknown`, {
          params: {
            includeUnassigned: 'true', // Include all leads, including campaign leads
          },
        });

        if (unifiedLeadsResponse.status === 200 && unifiedLeadsResponse.data.leads) {
          // Get unique campaign leads (only original, not contractor-assigned versions)
          const campaignLeadsMap = new Map();
          
          unifiedLeadsResponse.data.leads
            .filter((lead: any) => 
              lead.projectId && 
              lead.projectId.startsWith('CAMPAIGN-') &&
              !lead.assignedTo // Only original campaign leads, not assigned versions
            )
            .forEach((lead: any) => {
              // Match trade type
              const leadTrade = (lead.trade || '').toLowerCase();
              const normalizedTrade = trade.toLowerCase();
              const tradeMatches = leadTrade.includes(normalizedTrade) || 
                                 normalizedTrade.includes(leadTrade) ||
                                 Object.values(tradeMap).some((mappedTrade: string) => 
                                   leadTrade.includes(mappedTrade) || mappedTrade.includes(leadTrade)
                                 );

              if (tradeMatches && !campaignLeadsMap.has(lead.projectId)) {
                // Extract campaign name from title (format: "Company Name - Service")
                const titleParts = (lead.title || '').split(' - ');
                const companyName = titleParts[0] || lead.title || 'Unknown Company';
                
                campaignLeadsMap.set(lead.projectId, {
                  name: companyName,
                  rating: 4.5, // Default rating for campaigns
                  reviewCount: 0,
                  phone: lead.contact?.phone || null,
                  address: '',
                  city: lead.location?.city || '',
                  state: lead.location?.state || '',
                  zip: lead.location?.zip || '',
                  distance: null,
                  url: null,
                  price: null,
                  categories: [lead.trade].filter(Boolean),
                  source: 'campaign',
                  sourceLabel: 'Campaign Creator',
                  campaignId: lead.projectId,
                  trade: lead.trade,
                  hasCampaign: true,
                  verified: lead.verified || false,
                });
              }
            });

          const campaignContractors = Array.from(campaignLeadsMap.values());
          allContractors.push(...campaignContractors);
          console.log(`📊 Found ${campaignContractors.length} campaign contractors for ${trade}`);
        }
      } catch (campaignError) {
        console.warn('Campaign search failed:', campaignError);
      }

      // 3. Fetch app users/contractors from contractors API
      try {
        const contractorsResponse = await axios.get(`http://localhost:3001/api/contractors`);

        if (contractorsResponse.status === 200 && contractorsResponse.data.contractors) {
          const appContractors = contractorsResponse.data.contractors
            .filter((c: any) => {
              // Match trade type
              const contractorTrades = (c.trades || c.tradeTypes || []).map((t: string) => t.toLowerCase());
              const normalizedTrade = trade.toLowerCase();
              return contractorTrades.some((t: string) => 
                t.includes(normalizedTrade) || 
                normalizedTrade.includes(t) ||
                tradeMap[normalizedTrade] === t
              );
            })
            .map((c: any) => ({
              name: c.company || c.name || 'Unknown Contractor',
              rating: c.rating || 4.0,
              reviewCount: c.reviews || 0,
              phone: c.phone || null,
              address: c.address || '',
              city: c.location?.city || c.city || '',
              state: c.location?.state || c.state || '',
              zip: c.location?.zip || c.zipCode || '',
              distance: null,
              url: null,
              price: null,
              categories: c.trades || c.tradeTypes || [],
              source: 'app',
              sourceLabel: 'App User',
              licensed: c.licensed || false,
              insured: c.insured || false,
            }));

          allContractors.push(...appContractors);
        }
      } catch (contractorError) {
        console.warn('Contractor API search failed:', contractorError);
      }

      // Combine and sort all contractors
      // Prioritize: Campaigns > App Users > Yelp (then by rating)
      const sortedContractors = allContractors.sort((a: any, b: any) => {
        // Priority: campaign > app > yelp
        const sourcePriority: Record<string, number> = { 'campaign': 3, 'app': 2, 'yelp': 1 };
        const aPriority = sourcePriority[a.source] || 0;
        const bPriority = sourcePriority[b.source] || 0;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        
        // Same source: sort by rating
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }
        
        // Same rating: sort by review count
        return (b.reviewCount || 0) - (a.reviewCount || 0);
      }).slice(0, 10); // Return top 10

      const hasMockData = allContractors.some((c: any) => c.isMockData);

      return {
        trade,
        location: searchLocation,
        contractors: sortedContractors,
        total: sortedContractors.length,
        isMockData: hasMockData,
        sources: {
          yelp: allContractors.filter((c: any) => c.source === 'yelp').length,
          campaigns: allContractors.filter((c: any) => c.source === 'campaign').length,
          app: allContractors.filter((c: any) => c.source === 'app').length,
        },
      };
    } catch (error) {
      console.error('Contractor search error:', error);
      return {
        trade,
        location: searchLocation,
        error: error instanceof Error ? error.message : 'Search failed',
        contractors: [],
      };
    }

    return {
      trade,
      location: searchLocation,
      contractors: [],
      error: 'No results found',
    };
  },

  async updateOverheadMarkup(args: {
    project_name: string;
    insurance_overhead?: number;
    equipment?: number;
    facilities?: number;
    other_overhead?: number;
    markup_percent?: number;
    context?: string;
  }) {
    console.log("Updating overhead and markup:", args);

    // Find the project
    let projectData = null;
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        // Try to find project by name
        projectData = allProjects.find((p: any) => {
          const projectName = (p.title || '').toLowerCase();
          const searchName = args.project_name.toLowerCase();
          return projectName.includes(searchName) || searchName.includes(projectName);
        });
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    return {
      projectName: args.project_name,
      projectId: projectData?.id || null,
      insuranceOverhead: args.insurance_overhead,
      equipment: args.equipment,
      facilities: args.facilities,
      otherOverhead: args.other_overhead,
      markupPct: args.markup_percent,
      success: true,
    };
  },

  async addPaymentMilestone(args: {
    project_name: string;
    milestone_name: string;
    percentage?: number;
    amount?: number;
    scheduled_date?: string;
    description?: string;
    context?: string;
  }) {
    console.log("Adding payment milestone:", args);

    // Find the project
    let projectData = null;
    let projectId: string | undefined;
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        // Try to find project by name
        projectData = allProjects.find((p: any) => {
          const projectName = (p.title || '').toLowerCase();
          const searchName = args.project_name.toLowerCase();
          return projectName.includes(searchName) || searchName.includes(projectName);
        });
        
        if (projectData) {
          projectId = projectData.id;
        } else if (context.bidTitle) {
          // Fallback to current bid if project name matches
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            projectData = { title: context.bidTitle, id: null };
          }
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    const milestoneId = `milestone-${Date.now()}`;
    const milestone = {
      id: milestoneId,
      name: args.milestone_name,
      title: args.milestone_name,
      description: args.description || '',
      percentage: args.percentage || 0,
      amount: args.amount || 0,
      paymentAmount: args.amount || 0,
      scheduledDate: args.scheduled_date || new Date().toISOString().split('T')[0],
      dueDate: args.scheduled_date || new Date().toISOString().split('T')[0],
      plannedDate: args.scheduled_date || new Date().toISOString().split('T')[0],
      status: 'pending',
      progressPct: 0,
    };

    if (!projectData && !args.context) {
      return {
        error: "PROJECT_NOT_FOUND",
        message: `Project '${args.project_name}' not found.`,
        projectName: args.project_name,
      };
    }

    return {
      projectName: projectData?.title || args.project_name,
      projectId: projectId || null,
      milestone: milestone,
      success: true,
    };
  },

  async addWeeklyPayment(args: {
    project_name: string;
    week_number?: number;
    amount?: number;
    scheduled_date?: string;
    description?: string;
    context?: string;
  }) {
    console.log("Adding weekly payment:", args);

    // Find the project
    let projectData = null;
    let projectId: string | undefined;
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        // Try to find project by name
        projectData = allProjects.find((p: any) => {
          const projectName = (p.title || '').toLowerCase();
          const searchName = args.project_name.toLowerCase();
          return projectName.includes(searchName) || searchName.includes(projectName);
        });
        
        if (projectData) {
          projectId = projectData.id;
        } else if (context.bidTitle) {
          // Fallback to current bid if project name matches
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            projectData = { title: context.bidTitle, id: null };
          }
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    // Determine week number if not provided
    let weekNumber = args.week_number;
    if (!weekNumber && args.context) {
      try {
        const context = JSON.parse(args.context);
        const existingPayments = context.bidData?.weeklyPayments || [];
        weekNumber = existingPayments.length + 1;
      } catch (e) {
        weekNumber = 1;
      }
    }
    weekNumber = weekNumber || 1;

    const paymentId = `weekly-${Date.now()}`;
    const payment = {
      id: paymentId,
      weekNumber: weekNumber,
      description: args.description || `Week ${weekNumber} Progress Payment`,
      amount: args.amount || 0,
      paymentAmount: args.amount || 0,
      scheduledDate: args.scheduled_date || new Date().toISOString().split('T')[0],
      dueDate: args.scheduled_date || new Date().toISOString().split('T')[0],
      plannedDate: args.scheduled_date || new Date().toISOString().split('T')[0],
      status: 'pending',
      progressPct: 0,
    };

    if (!projectData && !args.context) {
      return {
        error: "PROJECT_NOT_FOUND",
        message: `Project '${args.project_name}' not found.`,
        projectName: args.project_name,
      };
    }

    return {
      projectName: projectData?.title || args.project_name,
      projectId: projectId || null,
      payment: payment,
      success: true,
    };
  },

  async setPaymentScheduleType(args: {
    project_name: string;
    schedule_type: 'milestone-based' | 'weekly';
    context?: string;
  }) {
    console.log("Setting payment schedule type:", args);

    // Find the project
    let projectData = null;
    let projectId: string | undefined;
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        // Try to find project by name
        projectData = allProjects.find((p: any) => {
          const projectName = (p.title || '').toLowerCase();
          const searchName = args.project_name.toLowerCase();
          return projectName.includes(searchName) || searchName.includes(projectName);
        });
        
        if (projectData) {
          projectId = projectData.id;
        } else if (context.bidTitle) {
          // Fallback to current bid if project name matches
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            projectData = { title: context.bidTitle, id: null };
          }
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    return {
      projectName: projectData?.title || args.project_name,
      projectId: projectId || null,
      paymentSchedule: args.schedule_type,
      success: true,
    };
  },

  async setWorkSchedule(args: {
    project_name: string;
    work_schedule: 'weekdays' | 'flexible';
    context?: string;
  }) {
    console.log("Setting work schedule:", args);

    // Find the project
    let projectData = null;
    let projectId: string | undefined;
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        // Try to find project by name
        projectData = allProjects.find((p: any) => {
          const projectName = (p.title || '').toLowerCase();
          const searchName = args.project_name.toLowerCase();
          return projectName.includes(searchName) || searchName.includes(projectName);
        });
        
        if (projectData) {
          projectId = projectData.id;
        } else if (context.bidTitle) {
          // Fallback to current bid if project name matches
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            projectData = { title: context.bidTitle, id: null };
          }
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    return {
      projectName: projectData?.title || args.project_name,
      projectId: projectId || null,
      workSchedule: args.work_schedule,
      success: true,
    };
  },

  async setProjectTimeline(args: {
    project_name: string;
    start_date?: string;
    duration_days?: number;
    context?: string;
  }) {
    console.log("Setting project timeline:", args);

    // Find the project
    let projectData = null;
    let projectId: string | undefined;
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        // Try to find project by name
        projectData = allProjects.find((p: any) => {
          const projectName = (p.title || '').toLowerCase();
          const searchName = args.project_name.toLowerCase();
          return projectName.includes(searchName) || searchName.includes(projectName);
        });
        
        if (projectData) {
          projectId = projectData.id;
        } else if (context.bidTitle) {
          // Fallback to current bid if project name matches
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            projectData = { title: context.bidTitle, id: null };
          }
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    return {
      projectName: projectData?.title || args.project_name,
      projectId: projectId || null,
      startDate: args.start_date,
      durationDays: args.duration_days,
      success: true,
    };
  },

  async shareContract(args: {
    project_name: string;
    share_method: 'email' | 'text' | 'sms';
    email?: string;
    phone_number?: string;
    context?: string;
  }) {
    console.log("Sharing contract:", args);
    console.log("Context type:", typeof args.context);
    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        console.log("Parsed context keys:", Object.keys(context));
        console.log("allProjects count:", context.allProjects?.length || 0);
        if (context.allProjects && context.allProjects.length > 0) {
          console.log("Sample project titles:", context.allProjects.slice(0, 3).map((p: any) => p.title));
        }
        console.log("bidTitle:", context.bidTitle);
      } catch (e) {
        console.error("Error parsing context for logging:", e);
      }
    }

    // Find the project
    let projectData = null;
    let projectId: string | undefined;
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        // Try to find project by name
        projectData = allProjects.find((p: any) => {
          const projectName = (p.title || '').toLowerCase().trim();
          const searchName = args.project_name.toLowerCase().trim();
          // Check if project name contains search term or search term contains project name
          return projectName.includes(searchName) || searchName.includes(projectName);
        });
        
        if (projectData) {
          projectId = projectData.id;
        } else if (context.bidTitle) {
          // Fallback to current bid if project name matches
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            projectData = { title: context.bidTitle, id: null };
          }
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    if (!projectData) {
      console.log(`❌ Project not found: "${args.project_name}"`);
      const context = args.context ? JSON.parse(args.context) : null;
      const availableProjects = context?.allProjects?.map((p: any) => p.title) || [];
      console.log("Available projects:", availableProjects);
      return {
        error: "PROJECT_NOT_FOUND",
        message: `Project '${args.project_name}' not found. Available projects: ${availableProjects.join(', ') || 'none'}. Please make sure the project exists and the name is correct.`,
        projectName: args.project_name,
        success: false,
      };
    }

    console.log(`✅ Project found: ${projectData.title} (id: ${projectId || 'null'})`);
    return {
      projectName: projectData.title || args.project_name,
      projectId: projectId || null,
      shareMethod: args.share_method,
      email: args.email,
      phoneNumber: args.phone_number,
      success: true,
    };
  },

  async showContract(args: {
    project_name: string;
    context?: string;
  }) {
    console.log("Showing contract:", args);
    console.log("Context type:", typeof args.context);
    if (args.context) {
      try {
        const context = JSON.parse(args.context);
        console.log("Parsed context keys:", Object.keys(context));
        console.log("allProjects count:", context.allProjects?.length || 0);
        if (context.allProjects && context.allProjects.length > 0) {
          console.log("Sample project titles:", context.allProjects.slice(0, 3).map((p: any) => p.title));
        }
        console.log("bidTitle:", context.bidTitle);
      } catch (e) {
        console.error("Error parsing context for logging:", e);
      }
    }

    // Find the project
    let projectData = null;
    let projectId: string | undefined;
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        // Try to find project by name
        projectData = allProjects.find((p: any) => {
          const projectName = (p.title || '').toLowerCase().trim();
          const searchName = args.project_name.toLowerCase().trim();
          // Check if project name contains search term or search term contains project name
          return projectName.includes(searchName) || searchName.includes(projectName);
        });
        
        if (projectData) {
          projectId = projectData.id;
        } else if (context.bidTitle) {
          // Fallback to current bid if project name matches
          const searchName = args.project_name.toLowerCase().trim();
          const bidTitle = (context.bidTitle || '').toLowerCase().trim();
          if (bidTitle.includes(searchName) || searchName.includes(bidTitle)) {
            // This is the current bid being edited - frontend will handle it
            console.log(`✅ Found current bid: ${context.bidTitle}`);
            return {
              projectName: context.bidTitle,
              projectId: context.bidId || null,
              success: true,
              isCurrentBid: true,
            };
          }
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    if (!projectData) {
      console.log(`❌ Project not found: "${args.project_name}"`);
      const context = args.context ? JSON.parse(args.context) : null;
      const availableProjects = context?.allProjects?.map((p: any) => p.title) || [];
      console.log("Available projects:", availableProjects);
      console.log("Current bid title:", context?.bidTitle);
      return {
        error: "PROJECT_NOT_FOUND",
        message: `Project '${args.project_name}' not found. Available projects: ${availableProjects.join(', ') || 'none'}. Please make sure the project exists and the name is correct.`,
        projectName: args.project_name,
        success: false,
      };
    }

    console.log(`✅ Project found: ${projectData.title} (id: ${projectId || 'null'})`);
    return {
      projectName: projectData.title || args.project_name,
      projectId: projectId || null,
      success: true,
    };
  },

  async logDailyProgress(args: {
    project_id?: string;
    project_name?: string;
    entry_date?: string;
    summary: string;
    details?: string;
    weather?: string;
    crew?: string[];
    tags?: string[];
    context?: string;
  }) {
    console.log("Logging daily progress:", args);
    
    let projectData = null;
    let projectId: string | undefined = args.project_id;
    
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        if (projectId) {
          projectData = allProjects.find((p: any) => p.id === projectId);
        } else if (args.project_name) {
          projectData = allProjects.find((p: any) => {
            const projectName = (p.title || '').toLowerCase().trim();
            const searchName = args.project_name!.toLowerCase().trim();
            return projectName.includes(searchName) || searchName.includes(projectName);
          });
          if (projectData) projectId = projectData.id;
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    const entryDate = args.entry_date || new Date().toISOString().split('T')[0];
    
    return {
      projectId: projectId || null,
      projectName: projectData?.title || args.project_name || 'Unknown',
      entryDate,
      summary: args.summary,
      details: args.details || '',
      weather: args.weather,
      crew: args.crew || [],
      tags: args.tags || [],
      success: true,
    };
  },

  async forecastTotalCost(args: {
    project_id?: string;
    project_name?: string;
    scenario?: 'base' | 'conservative' | 'aggressive';
    include_change_orders?: boolean;
    include_overhead?: boolean;
    include_markup?: boolean;
    context?: string;
  }) {
    console.log("Forecasting total cost:", args);
    
    let projectData = null;
    let projectId: string | undefined = args.project_id;
    
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        if (projectId) {
          projectData = allProjects.find((p: any) => p.id === projectId);
        } else if (args.project_name) {
          projectData = allProjects.find((p: any) => {
            const projectName = (p.title || '').toLowerCase().trim();
            const searchName = args.project_name!.toLowerCase().trim();
            return projectName.includes(searchName) || searchName.includes(projectName);
          });
          if (projectData) projectId = projectData.id;
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    if (!projectData) {
      return {
        error: "PROJECT_NOT_FOUND",
        message: `Project not found. Please specify a valid project name or ID.`,
        success: false,
      };
    }

    const scenario = args.scenario || 'base';
    const includeChangeOrders = args.include_change_orders !== false;
    const includeOverhead = args.include_overhead !== false;
    const includeMarkup = args.include_markup !== false;

    // Calculate forecast based on project data
    const baseCost = projectData.totalBudget || projectData.estimatedCost || projectData.bidPrice || 0;
    const actualSpent = projectData.actualCost || 0;
    const remainingBudget = baseCost - actualSpent;

    let forecast = baseCost;
    if (scenario === 'conservative') {
      forecast = baseCost * 1.15; // 15% overrun
    } else if (scenario === 'aggressive') {
      forecast = baseCost * 0.95; // 5% under budget
    }

    return {
      projectId: projectId || null,
      projectName: projectData.title || args.project_name || 'Unknown',
      scenario,
      baseCost,
      actualSpent,
      remainingBudget,
      forecastTotal: forecast,
      includeChangeOrders,
      includeOverhead,
      includeMarkup,
      success: true,
    };
  },

  async findAlternativeMaterials(args: {
    project_id?: string;
    project_name?: string;
    reference_item_id?: string;
    search_term: string;
    quantity?: number;
    unit?: string;
    location?: string;
    context?: string;
  }) {
    console.log("Finding alternative materials:", args);
    
    let projectData = null;
    let projectId: string | undefined = args.project_id;
    
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        if (projectId) {
          projectData = allProjects.find((p: any) => p.id === projectId);
        } else if (args.project_name) {
          projectData = allProjects.find((p: any) => {
            const projectName = (p.title || '').toLowerCase().trim();
            const searchName = args.project_name!.toLowerCase().trim();
            return projectName.includes(searchName) || searchName.includes(projectName);
          });
          if (projectData) projectId = projectData.id;
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    // This would integrate with material price search API
    // For now, return a placeholder structure
    return {
      projectId: projectId || null,
      projectName: projectData?.title || args.project_name || 'Unknown',
      searchTerm: args.search_term,
      quantity: args.quantity,
      unit: args.unit,
      location: args.location,
      alternatives: [], // Would be populated by actual API call
      success: true,
    };
  },

  async generateProjectProposal(args: {
    project_id?: string;
    project_name?: string;
    audience_name?: string;
    audience_type: 'homeowner' | 'gc' | 'developer' | 'investor' | 'other';
    include_payment_schedule?: boolean;
    include_timeline?: boolean;
    include_terms?: boolean;
    format?: 'markdown' | 'html' | 'pdf_draft';
    language_code?: string;
    context?: string;
  }) {
    console.log("Generating project proposal:", args);
    
    let projectData = null;
    let projectId: string | undefined = args.project_id;
    
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        if (projectId) {
          projectData = allProjects.find((p: any) => p.id === projectId);
        } else if (args.project_name) {
          projectData = allProjects.find((p: any) => {
            const projectName = (p.title || '').toLowerCase().trim();
            const searchName = args.project_name!.toLowerCase().trim();
            return projectName.includes(searchName) || searchName.includes(projectName);
          });
          if (projectData) projectId = projectData.id;
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    if (!projectData) {
      return {
        error: "PROJECT_NOT_FOUND",
        message: `Project not found. Please specify a valid project name or ID.`,
        success: false,
      };
    }

    const format = args.format || 'markdown';
    const includePaymentSchedule = args.include_payment_schedule !== false;
    const includeTimeline = args.include_timeline !== false;
    const includeTerms = args.include_terms || false;

    return {
      projectId: projectId || null,
      projectName: projectData.title || args.project_name || 'Unknown',
      audienceName: args.audience_name || projectData.customerName || 'Client',
      audienceType: args.audience_type,
      format,
      includePaymentSchedule,
      includeTimeline,
      includeTerms,
      languageCode: args.language_code || 'en',
      proposalContent: '', // Would be generated based on project data
      success: true,
    };
  },

  async exportEstimatePdf(args: {
    project_id?: string;
    project_name?: string;
    include_overhead_breakdown?: boolean;
    include_markup_breakdown?: boolean;
    include_company_branding?: boolean;
    send_via?: 'download' | 'email' | 'link';
    recipient_email?: string;
    context?: string;
  }) {
    console.log("Exporting estimate PDF:", args);
    
    let projectData = null;
    let projectId: string | undefined = args.project_id;
    
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        if (projectId) {
          projectData = allProjects.find((p: any) => p.id === projectId);
        } else if (args.project_name) {
          projectData = allProjects.find((p: any) => {
            const projectName = (p.title || '').toLowerCase().trim();
            const searchName = args.project_name!.toLowerCase().trim();
            return projectName.includes(searchName) || searchName.includes(projectName);
          });
          if (projectData) projectId = projectData.id;
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    if (!projectData) {
      return {
        error: "PROJECT_NOT_FOUND",
        message: `Project not found. Please specify a valid project name or ID.`,
        success: false,
      };
    }

    const sendVia = args.send_via || 'download';
    const includeOverheadBreakdown = args.include_overhead_breakdown || false;
    const includeMarkupBreakdown = args.include_markup_breakdown || false;
    const includeCompanyBranding = args.include_company_branding !== false;

    return {
      projectId: projectId || null,
      projectName: projectData.title || args.project_name || 'Unknown',
      sendVia,
      recipientEmail: args.recipient_email,
      includeOverheadBreakdown,
      includeMarkupBreakdown,
      includeCompanyBranding,
      pdfUri: null, // Would be generated by PDF service
      downloadLink: null, // Would be generated if send_via is 'link'
      success: true,
    };
  },

  async safetyChecklist(args: {
    project_id?: string;
    project_name?: string;
    job_type?: 'kitchen_remodel' | 'bath_remodel' | 'addition' | 'new_build' | 'commercial' | 'other';
    phase?: 'demo' | 'rough_in' | 'framing' | 'drywall' | 'finishes' | 'punch' | 'multi_phase' | 'general';
    focus?: 'general' | 'electrical' | 'plumbing' | 'ladder_scaffold' | 'hvac' | 'roofing';
    format?: 'checklist' | 'markdown' | 'pdf_draft';
    context?: string;
  }) {
    console.log("Generating safety checklist:", args);
    
    let projectData = null;
    let projectId: string | undefined = args.project_id;
    
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        if (projectId) {
          projectData = allProjects.find((p: any) => p.id === projectId);
        } else if (args.project_name) {
          projectData = allProjects.find((p: any) => {
            const projectName = (p.title || '').toLowerCase().trim();
            const searchName = args.project_name!.toLowerCase().trim();
            return projectName.includes(searchName) || searchName.includes(projectName);
          });
          if (projectData) projectId = projectData.id;
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    const jobType = args.job_type || 'other';
    const phase = args.phase || 'general';
    const focus = args.focus || 'general';
    const format = args.format || 'checklist';

    return {
      projectId: projectId || null,
      projectName: projectData?.title || args.project_name || 'Unknown',
      jobType,
      phase,
      focus,
      format,
      checklistItems: [], // Would be generated based on job type, phase, and focus
      success: true,
    };
  },

  async recommendNextSteps(args: {
    project_id?: string;
    project_name?: string;
    time_horizon?: 'today' | 'this_week' | 'before_inspection' | 'overall';
    focus?: 'schedule' | 'profit' | 'client_communication' | 'risk' | 'everything';
    context?: string;
  }) {
    console.log("Recommending next steps:", args);
    
    let projectData = null;
    let projectId: string | undefined = args.project_id;
    
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        if (projectId) {
          projectData = allProjects.find((p: any) => p.id === projectId);
        } else if (args.project_name) {
          projectData = allProjects.find((p: any) => {
            const projectName = (p.title || '').toLowerCase().trim();
            const searchName = args.project_name!.toLowerCase().trim();
            return projectName.includes(searchName) || searchName.includes(projectName);
          });
          if (projectData) projectId = projectData.id;
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    if (!projectData) {
      return {
        error: "PROJECT_NOT_FOUND",
        message: `Project not found. Please specify a valid project name or ID.`,
        success: false,
      };
    }

    const timeHorizon = args.time_horizon || 'overall';
    const focus = args.focus || 'everything';

    return {
      projectId: projectId || null,
      projectName: projectData.title || args.project_name || 'Unknown',
      timeHorizon,
      focus,
      recommendations: [], // Would be generated based on project analysis
      success: true,
    };
  },

  async generateClientUpdate(args: {
    project_id?: string;
    project_name?: string;
    audience_name?: string;
    language_code?: string;
    tone?: 'friendly' | 'formal' | 'brief' | 'detailed';
    include_financials?: boolean;
    include_schedule?: boolean;
    include_open_items?: boolean;
    channel?: 'plain_text' | 'email_body' | 'sms_length';
    context?: string;
  }) {
    console.log("Generating client update:", args);
    
    let projectData = null;
    let projectId: string | undefined = args.project_id;
    
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        if (projectId) {
          projectData = allProjects.find((p: any) => p.id === projectId);
        } else if (args.project_name) {
          projectData = allProjects.find((p: any) => {
            const projectName = (p.title || '').toLowerCase().trim();
            const searchName = args.project_name!.toLowerCase().trim();
            return projectName.includes(searchName) || searchName.includes(projectName);
          });
          if (projectData) projectId = projectData.id;
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    if (!projectData) {
      return {
        error: "PROJECT_NOT_FOUND",
        message: `Project not found. Please specify a valid project name or ID.`,
        success: false,
      };
    }

    const tone = args.tone || 'friendly';
    const channel = args.channel || 'plain_text';
    const includeFinancials = args.include_financials !== false;
    const includeSchedule = args.include_schedule !== false;
    const includeOpenItems = args.include_open_items || false;

    return {
      projectId: projectId || null,
      projectName: projectData.title || args.project_name || 'Unknown',
      audienceName: args.audience_name || projectData.customerName || 'Client',
      tone,
      channel,
      includeFinancials,
      includeSchedule,
      includeOpenItems,
      languageCode: args.language_code || 'en',
      updateText: '', // Would be generated based on project data
      success: true,
    };
  },

  async translateUpdate(args: {
    original_text: string;
    source_language_code?: string;
    target_language_code: string;
    tone?: string;
  }) {
    console.log("Translating update:", args);
    
    return {
      originalText: args.original_text,
      sourceLanguageCode: args.source_language_code || 'en',
      targetLanguageCode: args.target_language_code,
      tone: args.tone,
      translatedText: '', // Would be generated by translation service
      success: true,
    };
  },

  async profitabilityForecastPro(args: {
    project_id?: string;
    project_name?: string;
    scenario?: 'base' | 'conservative' | 'aggressive';
    target_margin_percent?: number;
    include_cashflow?: boolean;
    include_sensitivity?: boolean;
    time_horizon_weeks?: number;
    context?: string;
  }) {
    console.log("Generating profitability forecast pro:", args);
    
    let projectData = null;
    let projectId: string | undefined = args.project_id;
    
    try {
      if (args.context) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        if (projectId) {
          projectData = allProjects.find((p: any) => p.id === projectId);
        } else if (args.project_name) {
          projectData = allProjects.find((p: any) => {
            const projectName = (p.title || '').toLowerCase().trim();
            const searchName = args.project_name!.toLowerCase().trim();
            return projectName.includes(searchName) || searchName.includes(projectName);
          });
          if (projectData) projectId = projectData.id;
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    if (!projectData) {
      return {
        error: "PROJECT_NOT_FOUND",
        message: `Project not found. Please specify a valid project name or ID.`,
        success: false,
      };
    }

    const scenario = args.scenario || 'base';
    const includeCashflow = args.include_cashflow || false;
    const includeSensitivity = args.include_sensitivity || false;
    const timeHorizonWeeks = args.time_horizon_weeks || 12;

    return {
      projectId: projectId || null,
      projectName: projectData.title || args.project_name || 'Unknown',
      scenario,
      targetMarginPercent: args.target_margin_percent,
      includeCashflow,
      includeSensitivity,
      timeHorizonWeeks,
      forecast: {}, // Would contain detailed forecast data
      success: true,
    };
  },

  async aiProjectManagerMode(args: {
    project_id?: string;
    project_name?: string;
    enabled: boolean;
    aggressiveness?: 'low' | 'medium' | 'high';
    notify_about?: 'all' | 'schedule_only' | 'profit_only' | 'missing_info';
    preferred_channel?: 'in_app' | 'email_summary' | 'both';
    context?: string;
  }) {
    console.log("Configuring AI project manager mode:", args);
    
    let projectId: string | undefined = args.project_id;
    
    try {
      if (args.context && args.project_name) {
        const context = JSON.parse(args.context);
        const allProjects = context.allProjects || [];
        
        if (!projectId) {
          const projectData = allProjects.find((p: any) => {
            const projectName = (p.title || '').toLowerCase().trim();
            const searchName = args.project_name!.toLowerCase().trim();
            return projectName.includes(searchName) || searchName.includes(projectName);
          });
          if (projectData) projectId = projectData.id;
        }
      }
    } catch (e) {
      console.error("Error parsing context:", e);
    }

    return {
      projectId: projectId || null,
      projectName: args.project_name,
      enabled: args.enabled,
      aggressiveness: args.aggressiveness || 'medium',
      notifyAbout: args.notify_about || 'all',
      preferredChannel: args.preferred_channel || 'in_app',
      success: true,
    };
  },
};

// ----- Tool definitions (what AI is allowed to do) -----
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_new_bid",
      description:
        "Create a new bid/estimate in the app. Use this when the user wants to start a new estimate or bid. This will create a blank bid that they can then add materials, labor, and costs to. The bid will appear in the Estimates page.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Project title or name for the bid (e.g., 'Josh kitchen remodel', 'Main St Remodel').",
          },
          customer_name: {
            type: "string",
            description: "Customer or client name (e.g., 'Josh', 'John Smith').",
          },
          location: {
            type: "string",
            description: "Project location (e.g., 'St. George', 'Las Vegas, NV'). Optional.",
          },
          project_type: {
            type: "string",
            description: "Type of project. Valid values: 'kitchen', 'bathroom', 'room_addition', 'home_addition', 'new_build', 'landscaping', 'other'. " +
            "You can also use natural language like 'kitchen remodel', 'bathroom renovation', 'room addition', 'home addition', 'new construction', etc. " +
            "The system will automatically normalize these to valid project types. Optional, defaults to 'kitchen'.",
          },
          sqft: {
            type: "number",
            description: "Square footage of the project. Optional.",
          },
        },
        required: ["title", "customer_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_material_purchase",
      description:
        "Record a material purchase as an EXPENSE against the existing project budget. This does NOT increase the bid total. It records what was spent, which reduces the remaining budget in the Materials/Equipment category. " +
        "CRITICAL: Only use this when the user explicitly says they 'purchased', 'bought', or 'spent' money on materials (past tense - they already bought it). " +
        "If the user says 'add [amount] material' or 'add material' for a DRAFT/ESTIMATE project, use 'update_estimate_item' instead to add it to the estimate. " +
        "This tool is for recording expenses on WON/ACTIVE projects, not for adding materials to estimates. " +
        "REQUIRED: Before calling this tool, ensure you have: project_name, amount, vendor, and category (material name). " +
        "SMART DEFAULTS: If user mentions specific material types (lumber, tile, concrete, drywall, paint, electrical, plumbing, hardware, roofing, insulation, flooring, cabinets, appliances, windows, doors, siding, decking, fencing, landscaping), auto-categorize - only ask if truly unclear. " +
        "VENDOR NORMALIZATION: Normalize common vendors (Home Depot/HD, Lowe's/Lowes, Menards, Ace Hardware/Ace, Sherwin Williams/SW) to standard capitalization. " +
        "DATE HANDLING: If user says 'yesterday', 'last week', 'today', parse and include in notes field. " +
        "BATCH RECORDING: If user mentions multiple materials (e.g., 'I bought $500 of lumber and $300 of tile'), call this tool MULTIPLE times - once for each material.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description:
              "Project name as the user refers to it, e.g. 'Steve project'.",
          },
          amount: {
            type: "number",
            description: "Total purchase amount in USD.",
          },
          vendor: {
            type: "string",
            description: "Store or supplier, e.g. 'Home Depot'.",
          },
          category: {
            type: "string",
            description:
              "Material category such as 'Lumber', 'Concrete', 'Drywall', etc.",
          },
          notes: {
            type: "string",
            description:
              "Optional extra description or receipt details from the user.",
          },
        },
        required: ["project_name", "amount", "vendor", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_labor_expense",
      description:
        "Record a labor expense as an EXPENSE against the existing project budget. This records what was spent on labor (wages, subcontractors, etc.), which reduces the remaining budget in the Labor category. Use this when the user mentions paying for labor, wages, subcontractors, or crew work.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description:
              "Project name as the user refers to it, e.g. 'Steve project'.",
          },
          amount: {
            type: "number",
            description: "Total labor cost in USD.",
          },
          labor_type: {
            type: "string",
            description:
              "Type of labor such as 'Carpentry', 'Plumbing', 'Electrical', 'Subcontractor', etc.",
          },
          hours: {
            type: "number",
            description: "Number of hours worked (optional).",
          },
          rate: {
            type: "number",
            description: "Hourly rate in USD (optional).",
          },
          vendor: {
            type: "string",
            description: "Subcontractor name, crew, or 'Internal' for your own crew.",
          },
          notes: {
            type: "string",
            description: "Optional description of the work performed.",
          },
        },
        required: ["project_name", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_change_order",
      description:
        "Create a change order for a WON, ACTIVE, or COMPLETED project. Change orders modify the project scope and budget AFTER the bid has been sent and accepted. If approved, they increase the total project budget. " +
        "CRITICAL STATUS CHECK: BEFORE calling this tool, you MUST check the project's status in the context. " +
        "ONLY use this for projects with status 'won', 'active', 'in_progress', or 'completed'. " +
        "NEVER use this for projects with status 'estimate', 'draft', 'submitted', 'bid_submitted', or any status indicating it's still a draft/estimate. " +
        "For draft/estimate projects, ALWAYS use 'update_estimate_item' instead to add line items directly to the estimate. " +
        "If the user specifies materials and labor amounts separately, use materialsAmount and laborAmount. The total amount should equal materialsAmount + laborAmount. " +
        "If you're unsure about the project status, check the 'status' field in the allProjects array or use 'update_estimate_item' as a safe default for adding materials/labor.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description:
              "Project name as the user refers to it, e.g. 'Steve project'.",
          },
          title: {
            type: "string",
            description: "Title or description of the change order, e.g. 'Kitchen cabinet upgrade'.",
          },
          amount: {
            type: "number",
            description: "Total change order amount in USD (should equal materialsAmount + laborAmount if both are provided).",
          },
          materialsAmount: {
            type: "number",
            description: "Optional materials amount in USD. If provided along with laborAmount, the total amount should equal materialsAmount + laborAmount.",
          },
          laborAmount: {
            type: "number",
            description: "Optional labor amount in USD. If provided along with materialsAmount, the total amount should equal materialsAmount + laborAmount.",
          },
          approved: {
            type: "boolean",
            description: "Whether the change order is approved (default: false).",
          },
          notes: {
            type: "string",
            description: "Optional notes or details about the change order.",
          },
        },
        required: ["project_name", "title", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_purchase_order",
      description:
        "Create a purchase order (PO) for a project. Purchase orders represent committed spending that hasn't been received yet. They track what you've ordered but haven't paid for. Use this when the user mentions ordering materials, placing an order, or creating a PO.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description:
              "Project name as the user refers to it, e.g. 'Steve project'.",
          },
          vendor: {
            type: "string",
            description: "Vendor or supplier name, e.g. 'Home Depot', 'ABC Supply'.",
          },
          category: {
            type: "string",
            description: "Category such as 'Materials/Equipment', 'Labor', etc.",
          },
          amount: {
            type: "number",
            description: "Purchase order amount in USD.",
          },
          description: {
            type: "string",
            description: "Description of items being ordered.",
          },
          expectedDelivery: {
            type: "string",
            description: "Expected delivery date (optional, format: YYYY-MM-DD).",
          },
          notes: {
            type: "string",
            description: "Optional notes about the purchase order.",
          },
        },
        required: ["project_name", "vendor", "category", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "approve_change_order",
      description:
        "Approve an existing change order for a project. This will update the project's budget to include the change order amount. Use this when the user says to 'approve', 'apply', or 'accept' a change order.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description:
              "Project name as the user refers to it, e.g. 'Steve project'.",
          },
          change_order_title: {
            type: "string",
            description: "Title or description of the change order to approve (optional, can match by title).",
          },
          change_order_id: {
            type: "string",
            description: "ID of the change order to approve (optional, if known).",
          },
        },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_timeline_milestone",
      description:
        "Update the project timeline by changing the status, progress percentage, or planned date of a milestone (including weekly progress payments). Use this when the user says things like 'mark week 2 payment complete', 'push framing milestone to Friday', or 'set the inspection milestone to in progress'.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it.",
          },
          milestone_name: {
            type: "string",
            description: "Milestone or weekly payment name to update (e.g., 'Week 2 Progress Payment', 'Framing Inspection').",
          },
          new_status: {
            type: "string",
            enum: ["pending", "in_progress", "completed"],
            description: "Optional new status for the milestone.",
          },
          progress_pct: {
            type: "number",
            description: "Optional progress percentage (0-100).",
          },
          planned_date: {
            type: "string",
            description: "Optional new planned date in YYYY-MM-DD format.",
          },
          notes: {
            type: "string",
            description: "Optional notes explaining the update.",
          },
        },
        required: ["project_name", "milestone_name", "scheduled_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_missing_costs",
      description:
        "Analyze an estimate to find missing line items based on the project scope. Suggests materials and labor that may have been forgotten. Use this when the user asks what they're missing, wants to check their estimate completeness, or needs suggestions for overlooked costs.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it, e.g. 'Nick project', 'chris remodel', 'Josh kitchen remodel'. " +
            "CRITICAL: If the user's request is vague and doesn't specify which project (e.g., 'add material to the estimate', 'add $2000 for material'), you MUST ask 'Which project is this for?' BEFORE calling this tool. Do NOT guess or assume based on the currently open estimate - always ask if unclear.",
          },
        },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_projects",
      description:
        "Get a list of the user's recent and active projects. Use this when you need to know what projects are available, or when the user asks about 'my projects' or needs to select a project. Returns projects sorted by activity and recency.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of projects to return (default: 10)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project_snapshot",
      description:
        "Get a complete snapshot of a specific project by its ID. Use this when you have a project_id and need full project data including budget, costs, expenses, purchase orders, change orders, milestones, and status. This provides all the data needed for project analysis.",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "The project ID to get a snapshot for",
          },
        },
        required: ["project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_project",
      description:
        "Provide a comprehensive summary of a project's current status including completion percentage, materials/labor spent vs budget, outstanding purchase orders, pending change orders, and upcoming timeline milestones. Use this when the user asks for a project summary, status update, or health check.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it, e.g. 'Nick project', 'chris remodel', 'Josh kitchen remodel'. " +
            "CRITICAL: If the user's request is vague and doesn't specify which project (e.g., 'add material to the estimate', 'add $2000 for material'), you MUST ask 'Which project is this for?' BEFORE calling this tool. Do NOT guess or assume based on the currently open estimate - always ask if unclear.",
          },
        },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_project_profitability",
      description:
        "Calculate and analyze project profitability including total budget, total spent, variances, and projected final profit/loss. Use this when the user asks about profitability, budget status, or whether they're over/under budget.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it, e.g. 'Steve project'.",
          },
        },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "identify_project_risks",
      description:
        "Analyze a project to identify potential risks including overdue milestones, overspending, missing tasks, unapproved change orders, delays, and vendor issues. Use this when the user asks about risks, problems, or concerns with a project.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it, e.g. 'Nick project', 'chris remodel', 'Josh kitchen remodel'. " +
            "CRITICAL: If the user's request is vague and doesn't specify which project (e.g., 'add material to the estimate', 'add $2000 for material'), you MUST ask 'Which project is this for?' BEFORE calling this tool. Do NOT guess or assume based on the currently open estimate - always ask if unclear.",
          },
        },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_project_note",
      description:
        "Add a note or daily log entry to a project. Records field notes, updates, or observations. Use this when the user wants to record information about a project like 'plumber didn't show up' or 'slab passed inspection'.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it, e.g. 'Nick project', 'chris remodel', 'Josh kitchen remodel'. " +
            "CRITICAL: If the user's request is vague and doesn't specify which project (e.g., 'add material to the estimate', 'add $2000 for material'), you MUST ask 'Which project is this for?' BEFORE calling this tool. Do NOT guess or assume based on the currently open estimate - always ask if unclear.",
          },
          note: {
            type: "string",
            description: "The note or log entry to add to the project.",
          },
          note_type: {
            type: "string",
            description: "Optional type of note such as 'field', 'inspection', 'issue', 'update', or 'general'.",
          },
        },
        required: ["project_name", "note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_material_prices",
      description:
        "Search for material prices at Home Depot and/or Lowe's. Use this when the user asks about material prices, wants to compare prices between stores, or asks questions like 'where is [material] cheaper' or 'what is the price for [material]'. " +
        "CRITICAL: If the material query is vague or generic (e.g., just 'concrete', 'lumber', 'drywall' without size/weight/specifications), you MUST ask the user for clarification BEFORE calling this tool. " +
        "Ask for specific details like: weight (lbs), size (e.g., '2x4', '4x8'), dimensions, brand, or other specifications that would help identify the exact product. " +
        "Only call this tool when you have a reasonably specific product description (e.g., '60 pound concrete', '2x4 lumber', '4x8 drywall sheet'). " +
        "If the user asks for comparison or doesn't specify a store, search both stores. If they ask specifically about one store, search only that store. " +
        "Extract ZIP code from project context if available.",
      parameters: {
        type: "object",
        properties: {
          material: {
            type: "string",
            description: "The material or product to search for. MUST be specific enough to identify a particular product (e.g., '60 pound concrete', '2x4 lumber', '4x8 drywall sheet', 'Quikrete concrete mix'). " +
            "If the user only provides a generic term like 'concrete' or 'lumber' without specifications, DO NOT call this tool - ask for clarification instead.",
          },
          zip_code: {
            type: "string",
            description: "ZIP code for location-based pricing (e.g., '89011'). If not provided, try to extract from project context or use default.",
          },
          store: {
            type: "string",
            description: "Which store(s) to search: 'hd' for Home Depot only, 'lowes' for Lowe's only, or 'both' to search and compare both stores. Default to 'both' unless user specifies a single store.",
            enum: ["hd", "lowes", "both"],
          },
        },
        required: ["material"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_overhead_markup",
      description:
        "Update overhead costs and markup percentage for an estimate/project. Use this when the user wants to set or change overhead values (insurance, equipment rentals, site facilities, other overhead) or markup percentage. " +
        "CRITICAL PROJECT IDENTIFICATION: If the user's request is vague and doesn't specify which project (e.g., 'add overhead and markup', 'set overhead', 'update markup', 'let's add overhead and markup'), you MUST ask 'Which project is this for?' BEFORE calling this tool. Do NOT guess or assume based on the currently open estimate - always ask if unclear. " +
        "Overhead values should be in dollars (e.g., 500, 1000, 2000). Markup percentage should be a number between 0 and 100 (e.g., 15 for 15%, 18 for 18%). " +
        "RECOMMENDATION MODE: If the user asks 'what should I add for my overhead and markup' or 'what do you recommend I put for my overhead and markup', you MUST: " +
        "1. FIRST: If project is unclear, ask 'Which project is this for?' and WAIT for the user's response. " +
        "2. THEN: Extract current materials and labor totals from context (bidData.materialLineItems, bidData.laborLineItems, or allProjects). Calculate subtotal (materials + labor). " +
        "3. Determine project type from context to use appropriate benchmarks. " +
        "4. Calculate recommended overhead: Insurance 2-5% of subtotal, Equipment 3-8% (higher if heavy equipment), Facilities 1-3%, Other 2-4%. Total overhead should be 10-20% of subtotal. " +
        "5. Recommend markup: 15-18% (optimal range for most projects). " +
        "6. Present recommendations clearly with dollar amounts, then ASK if they want to apply them. Only call this tool AFTER user confirms. " +
        "DIRECT SET MODE: If user provides specific values (e.g., 'set markup to 18%', 'add $500 for insurance'), call this tool immediately with those values (but still ask for project name if unclear). " +
        "Industry benchmarks by project type: Kitchen 15-30% total overhead, Bathroom 15-28%, Room/Home Addition 12-25%, New Build 8-20%, General 12-20%.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it, e.g. 'chris remodel', 'Josh kitchen remodel'. " +
            "CRITICAL: If the user's request is vague and doesn't specify which project (e.g., 'add overhead and markup', 'set overhead', 'update markup', 'let's add overhead and markup'), you MUST ask 'Which project is this for?' BEFORE calling this tool. " +
            "Do NOT guess or assume based on the currently open estimate - always ask if unclear. " +
            "Only proceed with the tool call after you have confirmed the project name with the user.",
          },
          insurance_overhead: {
            type: "number",
            description: "Insurance overhead cost in dollars (typically 2-5% of materials + labor). Optional.",
          },
          equipment: {
            type: "number",
            description: "Equipment rentals cost in dollars (typically 3-8% of materials + labor, higher for heavy equipment projects). Optional.",
          },
          facilities: {
            type: "number",
            description: "Site facilities cost in dollars (typically 1-3% of materials + labor). Optional.",
          },
          other_overhead: {
            type: "number",
            description: "Other overhead costs in dollars (typically 2-4% of materials + labor). Optional.",
          },
          markup_percent: {
            type: "number",
            description: "Markup percentage as a number (e.g., 15 for 15%, 18 for 18%). Recommended: 15-18% for most projects. Optional.",
          },
        },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_payment_milestone",
      description:
        "Add a payment milestone to an estimate/project. Use this when the user wants to add a milestone-based payment. " +
        "CRITICAL: Before calling this tool, you MUST ask for ALL required information if the user's request is vague: " +
        "1. PROJECT NAME: If unclear, ask 'Which project is this for?' " +
        "2. MILESTONE NAME: If the user says 'add milestone' without specifying which milestone, ask 'What milestone is this for? (e.g., Deposit, Start of Work, Framing Complete, Final Payment)' " +
        "3. PAYMENT AMOUNT/PERCENTAGE: If the user doesn't provide amount or percentage, ask 'What payment amount (or percentage) do you want for this milestone?' " +
        "4. SCHEDULED DATE: If the user doesn't provide a date, ask 'When should this milestone payment be due? (e.g., December 15th, start of project, completion date)' " +
        "Only call this tool AFTER you have: project name, milestone name, amount OR percentage, and scheduled date. " +
        "Payment milestones are used when paymentSchedule is 'milestone-based'. Each milestone can have a percentage of total or a specific dollar amount. " +
        "Common milestone names: 'Deposit', 'Start of Work', 'Framing Complete', 'Drywall Complete', 'Final Payment', etc.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it, e.g. 'chris remodel', 'Josh kitchen remodel'. " +
            "CRITICAL: If the user's request is vague and doesn't specify which project, you MUST ask 'Which project is this for?' BEFORE calling this tool.",
          },
          milestone_name: {
            type: "string",
            description: "Name of the milestone (e.g., 'Deposit', 'Framing Complete', 'Final Payment', 'Start of Work'). " +
            "CRITICAL: If the user says 'add milestone' without specifying the name, you MUST ask 'What milestone is this for?' BEFORE calling this tool.",
          },
          percentage: {
            type: "number",
            description: "Percentage of total project cost for this milestone (0-100). Required if amount is not provided. " +
            "CRITICAL: If the user doesn't provide amount or percentage, you MUST ask 'What payment amount (or percentage) do you want for this milestone?' BEFORE calling this tool.",
          },
          amount: {
            type: "number",
            description: "Dollar amount for this milestone. Required if percentage is not provided. " +
            "CRITICAL: If the user doesn't provide amount or percentage, you MUST ask 'What payment amount (or percentage) do you want for this milestone?' BEFORE calling this tool.",
          },
          scheduled_date: {
            type: "string",
            description: "Scheduled date for this milestone in YYYY-MM-DD format. Parse natural language dates (e.g., 'December 15th', 'start of project', 'when framing is complete') into YYYY-MM-DD format. " +
            "CRITICAL: If the user doesn't provide a date, you MUST ask 'When should this milestone payment be due?' BEFORE calling this tool.",
          },
          description: {
            type: "string",
            description: "Optional description of what triggers this payment milestone.",
          },
        },
        required: ["project_name", "milestone_name", "scheduled_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_weekly_payment",
      description:
        "Add a weekly progress payment to an estimate/project. Use this when the user wants to add a weekly payment. " +
        "CRITICAL: Before calling this tool, you MUST ask for ALL required information if the user's request is vague: " +
        "1. PROJECT NAME: If unclear, ask 'Which project is this for?' " +
        "2. PAYMENT AMOUNT/PERCENTAGE: If the user says 'add weekly payment' without specifying amount or percentage, ask 'What payment amount (or percentage) do you want for this weekly payment?' " +
        "3. SCHEDULED DATE: If the user doesn't provide a date, ask 'When should this weekly payment be due? (e.g., December 15th, end of week 1, every Friday)' " +
        "4. WEEK NUMBER: Optional - will auto-increment if not provided, but you can ask if user wants to specify a particular week. " +
        "Only call this tool AFTER you have: project name, amount OR percentage, and scheduled date. " +
        "Weekly payments are used when paymentSchedule is 'weekly'. Each payment represents a weekly progress payment based on work accomplished.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it, e.g. 'chris remodel', 'Josh kitchen remodel'. " +
            "CRITICAL: If the user's request is vague and doesn't specify which project, you MUST ask 'Which project is this for?' BEFORE calling this tool.",
          },
          week_number: {
            type: "number",
            description: "Week number for this payment (1, 2, 3, etc.). Optional, will auto-increment if not provided.",
          },
          amount: {
            type: "number",
            description: "Dollar amount for this weekly payment. Required. " +
            "CRITICAL: If the user doesn't provide amount, you MUST ask 'What payment amount (or percentage) do you want for this weekly payment?' BEFORE calling this tool.",
          },
          scheduled_date: {
            type: "string",
            description: "Scheduled date for this payment in YYYY-MM-DD format. Parse natural language dates (e.g., 'December 15th', 'end of week 1', 'every Friday') into YYYY-MM-DD format. " +
            "CRITICAL: If the user doesn't provide a date, you MUST ask 'When should this weekly payment be due?' BEFORE calling this tool.",
          },
          description: {
            type: "string",
            description: "Optional description of what this weekly payment covers.",
          },
        },
        required: ["project_name", "amount", "scheduled_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_payment_schedule_type",
      description:
        "Set the payment schedule type for an estimate/project (milestone-based or weekly). Use this when the user wants to change the payment schedule type (e.g., 'use milestone payments', 'switch to weekly payments', 'set payment schedule to milestone-based'). " +
        "CRITICAL PROJECT IDENTIFICATION: If the user's request is vague and doesn't specify which project, you MUST ask 'Which project is this for?' BEFORE calling this tool.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it, e.g. 'chris remodel', 'Josh kitchen remodel'. " +
            "CRITICAL: If the user's request is vague and doesn't specify which project, you MUST ask 'Which project is this for?' BEFORE calling this tool.",
          },
          schedule_type: {
            type: "string",
            enum: ["milestone-based", "weekly"],
            description: "Payment schedule type: 'milestone-based' for milestone payments, 'weekly' for weekly progress payments.",
          },
        },
        required: ["project_name", "schedule_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_work_schedule",
      description:
        "Set the work schedule for an estimate/project (weekdays only or flexible). Use this when the user wants to set work schedule preferences (e.g., 'work weekdays only', 'set flexible schedule', 'work schedule to weekdays'). " +
        "CRITICAL PROJECT IDENTIFICATION: If the user's request is vague and doesn't specify which project, you MUST ask 'Which project is this for?' BEFORE calling this tool.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it, e.g. 'chris remodel', 'Josh kitchen remodel'. " +
            "CRITICAL: If the user's request is vague and doesn't specify which project, you MUST ask 'Which project is this for?' BEFORE calling this tool.",
          },
          work_schedule: {
            type: "string",
            enum: ["weekdays", "flexible"],
            description: "Work schedule type: 'weekdays' for weekdays only, 'flexible' for flexible schedule including weekends.",
          },
        },
        required: ["project_name", "work_schedule"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_project_timeline",
      description:
        "Set the project start date and/or duration for an estimate/project. Use this when the user wants to set project timeline (e.g., 'start date is December 15th', 'project will take 30 days', 'set timeline to start next Monday and last 4 weeks'). " +
        "CRITICAL PROJECT IDENTIFICATION: If the user's request is vague and doesn't specify which project, you MUST ask 'Which project is this for?' BEFORE calling this tool. " +
        "For dates, parse natural language (e.g., 'December 15th', 'next Monday', 'in 2 weeks') into YYYY-MM-DD format.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it, e.g. 'chris remodel', 'Josh kitchen remodel'. " +
            "CRITICAL: If the user's request is vague and doesn't specify which project, you MUST ask 'Which project is this for?' BEFORE calling this tool.",
          },
          start_date: {
            type: "string",
            description: "Project start date in YYYY-MM-DD format. Parse natural language dates into this format.",
          },
          duration_days: {
            type: "number",
            description: "Project duration in days (e.g., 30 for 30 days, 60 for 60 days).",
          },
        },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_contractors",
      description:
        "Search for top-rated contractors/subcontractors in your area for a specific trade (e.g., plumbing, electrical, HVAC, tile, framing, etc.). " +
        "Use this when the user asks to find contractors, subcontractors, or tradespeople for a specific trade type. " +
        "The tool will return top-rated contractors sorted by rating and review count. " +
        "If location is not specified, try to extract it from the current project context (customer location, ZIP code, etc.). " +
        "Common trade types include: plumbing, electrical, HVAC, framing, tile, drywall, roofing, painting, concrete, general contractor.",
      parameters: {
        type: "object",
        properties: {
          trade: {
            type: "string",
            description: "The trade type to search for (e.g., 'plumbing', 'electrical', 'hvac', 'tile', 'framing', 'drywall', 'roofing', 'painting', 'concrete', 'general contractor'). " +
            "If the user asks for 'contractors' or 'subcontractors' without specifying a trade, ask them what type of work they need (e.g., 'What type of contractor are you looking for? Plumbing, electrical, etc.?').",
          },
          location: {
            type: "string",
            description: "Location for the search (city, state, or ZIP code, e.g., 'Las Vegas, NV' or '89011'). " +
            "If not provided, try to extract from project context. If still not available, use a default location.",
          },
          zip_code: {
            type: "string",
            description: "ZIP code for location-based search (e.g., '89011'). If not provided, try to extract from project context.",
          },
        },
        required: ["trade"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_project_details",
      description:
        "Update project/bid details like budget range, project scope description, estimated start date, and estimated end date. " +
        "Use this when the user wants to set or change project parameters, timeline, or scope description. " +
        "For budget_range, use values: 'under-10k', '10k-25k', '25k-50k', '50k-100k', 'over-100k', or 'flexible'. " +
        "For dates, use YYYY-MM-DD format (e.g., '2025-12-15'). You can parse natural language dates like 'December 15th', 'next Monday', 'in 2 weeks', etc. into this format.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it, e.g. 'Josh kitchen remodel'.",
          },
          budget_range: {
            type: "string",
            description: "Budget range option: 'under-10k', '10k-25k', '25k-50k', '50k-100k', 'over-100k', or 'flexible'.",
          },
          scope_description: {
            type: "string",
            description: "Project scope and description text (e.g., 'Demo existing kitchen, install new cabinets, countertops, backsplash, flooring...').",
          },
          start_date: {
            type: "string",
            description: "Estimated start date in YYYY-MM-DD format (e.g., '2025-12-15'). Parse natural language dates into this format.",
          },
          end_date: {
            type: "string",
            description: "Estimated end date in YYYY-MM-DD format (e.g., '2026-01-15'). Parse natural language dates into this format.",
          },
        },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_customer_info",
      description:
        "Update customer/client information for a project or bid. Use this when the user wants to set or change customer contact details like name, email, phone, address, company, or notes. " +
        "You can update any combination of fields - only include the fields the user provided. " +
        "For addresses, you can parse a full address into street, city, state, and zip if the user provides it.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it, e.g. 'Josh kitchen remodel'.",
          },
          customer_name: {
            type: "string",
            description: "Customer or client name (e.g., 'Josh Smith', 'John Doe').",
          },
          email: {
            type: "string",
            description: "Customer email address (e.g., 'john@example.com').",
          },
          phone: {
            type: "string",
            description: "Customer phone number (can include formatting like '555-123-4567' or just digits).",
          },
          company: {
            type: "string",
            description: "Customer company name (optional).",
          },
          address: {
            type: "string",
            description: "Street address (e.g., '123 Main St'). If user provides full address, extract just the street portion.",
          },
          city: {
            type: "string",
            description: "City name (e.g., 'Las Vegas'). If user provides full address, extract the city portion.",
          },
          state: {
            type: "string",
            description: "State abbreviation or name (e.g., 'NV', 'Nevada'). If user provides full address, extract the state portion.",
          },
          zip: {
            type: "string",
            description: "Zip/postal code (e.g., '89101'). If user provides full address, extract the zip portion.",
          },
          notes: {
            type: "string",
            description: "Additional notes or special requirements about the customer (optional).",
          },
        },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_estimate_item",
      description:
        "Update or ADD line items in an estimate. CRITICAL: This is the PRIMARY tool to use when the user is in the Estimate Generator screen (context.screen === 'Estimate Generator' or context.status === 'estimate'). " +
        "When user says 'add material', 'add material cost', 'add 500 material spent', 'add it to my project budget' while in Estimate Generator → use this tool to ADD a new material line item. " +
        "When user says 'add labor', 'add labor cost' while in Estimate Generator → use this tool to ADD a new labor line item. " +
        "CRITICAL: Distinguish between 'UPDATE existing item' vs 'ADD new item'. " +
        "UPDATE: When user says 'update', 'change', 'modify' an existing item (e.g., 'update framing labor to $13,500', 'change tile labor to $15,000'). " +
        "ADD NEW: When user says 'add', 'create', 'new line item', 'new labor', 'new material' (e.g., 'add plumbing labor for $2000', 'create a new line item for electrical labor', 'add 500 material spent'). " +
        "For ADD NEW: Provide new_description (the name of the new item) AND new_amount. " +
        "For UPDATE: Provide item_description (name of existing item to find) AND new_amount. " +
        "REQUIRED INFORMATION: " +
        "- itemType: 'material' or 'labor' (REQUIRED) " +
        "- new_description: Name of the material/labor (REQUIRED for ADD NEW) " +
        "- new_amount: Amount in USD (REQUIRED) " +
        "- If missing material name, ask: 'What material was this for?' then immediately call this tool. " +
        "CRITICAL: Before calling this tool, you MUST ask clarifying questions if needed: " +
        "1. If project is unclear: 'Which project is this for?' " +
        "2. If adding material and the user only provides an amount without specifying what material (e.g., 'add $500 for material', 'add $2000 material'), you MUST ask 'What material is this for?' BEFORE calling this tool. Do NOT use generic descriptions like 'Materials', 'Material', or 'General Materials' - always get the specific material name first (e.g., 'Tile', 'Drywall', 'Lumber', 'Concrete'). " +
        "3. If adding labor/subcontractor work and the user says something vague like 'add sub labor', 'add subcontractor', 'add labor' without specifying the type, you MUST ask 'What type of labor is this for? (e.g., tile, plumbing, electrical, framing, etc.)' BEFORE calling this tool. Do NOT use generic descriptions like 'Labor' or 'Sub labor' - always get the specific trade/type first (e.g., 'Tile labor', 'Plumbing labor', 'Electrical labor', 'Framing labor'). " +
        "For draft/estimate projects (status: 'estimate', 'draft', 'submitted'), ALWAYS use this tool to add materials/labor - these are just line items in the estimate, NOT change orders. Change orders are ONLY for won/active/completed projects.",
      parameters: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Project name as the user refers to it, e.g. 'Nick project', 'chris remodel', 'Josh kitchen remodel'. " +
            "CRITICAL: If the user's request is vague and doesn't specify which project (e.g., 'add material to the estimate', 'add $2000 for material'), you MUST ask 'Which project is this for?' BEFORE calling this tool. Do NOT guess or assume based on the currently open estimate - always ask if unclear.",
          },
          item_description: {
            type: "string",
            description: "Description or name of an EXISTING line item to UPDATE. Only use this when the user wants to CHANGE an existing item. " +
            "CRITICAL: If updating a LABOR item, include 'labor' in the description (e.g., 'Tile labor', 'Framing labor', 'Plumbing labor'). " +
            "If updating a MATERIAL item, just use the material name (e.g., 'Tile', 'Lumber', 'Concrete'). " +
            "If the user says 'add', 'create', 'new', do NOT use item_description - use new_description instead.",
          },
          item_id: {
            type: "string",
            description: "Optional ID of the specific line item if known.",
          },
          new_amount: {
            type: "number",
            description: "Optional new total amount for the line item.",
          },
          new_quantity: {
            type: "number",
            description: "Optional new quantity for the line item.",
          },
          new_unit_cost: {
            type: "number",
            description: "Optional new unit cost (price per unit) for the line item.",
          },
          new_description: {
            type: "string",
            description: "REQUIRED when ADDING a NEW line item. The name/description of the new item to create (e.g., 'Plumbing labor', 'Electrical labor', 'Tile labor', 'Framing labor', 'Drywall', 'Tile', 'Lumber'). " +
            "Use this when the user says 'add', 'create', 'new line item', 'new labor', 'new material', 'add sub labor', 'add subcontractor'. " +
            "CRITICAL RULE - DO NOT USE GENERIC TERMS: " +
            "- For MATERIALS: If the user provides an amount but doesn't specify what material (e.g., 'add $500 for material', 'add $2000 material', 'add material'), you MUST ask 'What material is this for?' BEFORE calling this tool. NEVER use generic terms like 'Materials', 'Material', 'General Materials', or 'materials' - these are FORBIDDEN. You MUST ask for the specific material name first (e.g., 'Drywall', 'Tile', 'Lumber', 'Concrete', 'Paint', etc.). " +
            "- For LABOR: If the user says something vague like 'add sub labor', 'add subcontractor', 'add labor' without specifying the type, you MUST ask 'What type of labor is this for? (e.g., tile, plumbing, electrical, framing, etc.)' BEFORE calling this tool. NEVER use generic terms like 'Labor', 'Sub labor', or 'Subcontractor' - these are FORBIDDEN. You MUST ask for the specific trade/type first, then use format like 'Tile labor', 'Plumbing labor', 'Electrical labor', 'Framing labor', etc. " +
            "If the user wants to UPDATE an existing item, use item_description instead and leave new_description empty.",
          },
          project_scope: {
            type: "string",
            description: "Optional project scope/type when adding materials. Use one of: 'kitchen', 'bathroom', 'room_addition', 'home_addition', 'new_build', 'landscaping', or 'other'. " +
            "CRITICAL: If the user is adding a NEW material and the project has multiple scopes or the scope is unclear from context, you MUST ask the user which project scope this material is for before calling this tool. " +
            "Only omit this parameter if the project clearly has a single scope (e.g., the project title is 'Josh kitchen remodel' clearly indicates 'kitchen' scope).",
          },
        },
        required: ["project_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_daily_progress",
      description: "Create a daily log entry for a project (site activity, issues, notes). Use this whenever the user describes what happened on site today.",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "Internal project ID if known. Use this when you already know the active project."
          },
          project_name: {
            type: "string",
            description: "Human-readable project name (e.g. 'Chris remodel'). Use if project_id is not available."
          },
          entry_date: {
            type: "string",
            description: "Date for this log in YYYY-MM-DD format. Defaults to today if omitted."
          },
          summary: {
            type: "string",
            description: "Short 1–2 sentence summary of the day (e.g. 'Completed demo and rough plumbing, passed inspection')."
          },
          details: {
            type: "string",
            description: "Longer description of work performed, issues, client notes, inspections, etc."
          },
          weather: {
            type: "string",
            description: "Optional brief weather description if the user mentions it, e.g. 'Rainy and 45°F'."
          },
          crew: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of key crew members or subcontractors on site today."
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Optional tags such as 'inspection', 'delay', 'change-order', 'safety', etc."
          }
        },
        required: ["summary"]
      },
    },
  },
  {
    type: "function",
    function: {
      name: "forecast_total_cost",
      description: "Forecast the final total cost of a project based on current estimate, logged expenses, change orders, and remaining schedule.",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "Internal project ID if known."
          },
          project_name: {
            type: "string",
            description: "Project name if ID is not known."
          },
          scenario: {
            type: "string",
            enum: ["base", "conservative", "aggressive"],
            description: "Type of forecast. 'base' uses most likely assumptions, 'conservative' assumes higher costs / more overruns, 'aggressive' assumes tight control."
          },
          include_change_orders: {
            type: "boolean",
            description: "Whether to include approved change orders in the forecast. Default: true."
          },
          include_overhead: {
            type: "boolean",
            description: "Whether to include overhead in the forecast. Default: true."
          },
          include_markup: {
            type: "boolean",
            description: "Whether to include markup/profit in the forecast. Default: true."
          }
        }
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_alternative_materials",
      description: "Find alternative materials or equivalent products (e.g. different brand, size, or SKU) and compare pricing, typically using Home Depot and Lowe's price data.",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "Project ID if the material comes from an existing estimate item."
          },
          project_name: {
            type: "string",
            description: "Project name if ID is unknown."
          },
          reference_item_id: {
            type: "string",
            description: "Optional ID of an existing estimate line item to base the alternatives on."
          },
          search_term: {
            type: "string",
            description: "Description of the material to search alternatives for, e.g. 'R-15 fiberglass batt insulation', '2x4x8 #2 SPF studs'."
          },
          quantity: {
            type: "number",
            description: "Quantity needed for pricing comparison, if the user mentioned it."
          },
          unit: {
            type: "string",
            description: "Unit for the quantity (e.g. 'pieces', 'sqft', 'bags', 'gallons')."
          },
          location: {
            type: "string",
            description: "City or ZIP code to use for price checks. Defaults to the project location if available."
          }
        }
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_project_proposal",
      description: "Generate a client-facing project proposal based on the project scope, estimate, schedule, and payment terms.",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "Internal project ID for which to generate the proposal."
          },
          project_name: {
            type: "string",
            description: "Project name if ID is not known."
          },
          audience_name: {
            type: "string",
            description: "Client or company name to address in the proposal."
          },
          audience_type: {
            type: "string",
            enum: ["homeowner", "gc", "developer", "investor", "other"],
            description: "Type of audience the proposal is for so tone and details can be adjusted."
          },
          include_payment_schedule: {
            type: "boolean",
            description: "Whether to include the payment schedule in the proposal. Default: true."
          },
          include_timeline: {
            type: "boolean",
            description: "Whether to include project start date and timeline overview. Default: true."
          },
          include_terms: {
            type: "boolean",
            description: "Whether to include key terms/conditions section. Default: false if not specified."
          },
          format: {
            type: "string",
            enum: ["markdown", "html", "pdf_draft"],
            description: "Return format for the generated proposal content. 'pdf_draft' indicates the backend should render/save a PDF version."
          },
          language_code: {
            type: "string",
            description: "Optional BCP-47 language code (e.g. 'en', 'es') for the proposal. Defaults to English."
          }
        },
        required: ["audience_type"]
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_estimate_pdf",
      description: "Export the current project estimate as a branded PDF document that can be downloaded or shared with the client.",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "Internal project ID of the estimate to export."
          },
          project_name: {
            type: "string",
            description: "Project name if ID is not known."
          },
          include_overhead_breakdown: {
            type: "boolean",
            description: "If true, include a section that breaks down overhead by category."
          },
          include_markup_breakdown: {
            type: "boolean",
            description: "If true, include markup / profit explanation for the client."
          },
          include_company_branding: {
            type: "boolean",
            description: "If true, include the contractor's logo, business info and branding. Default: true."
          },
          send_via: {
            type: "string",
            enum: ["download", "email", "link"],
            description: "How to deliver the PDF: return a download link, email to client, or generate a shareable link."
          },
          recipient_email: {
            type: "string",
            description: "Client email address if send_via is 'email'."
          }
        }
      },
    },
  },
  {
    type: "function",
    function: {
      name: "safety_checklist",
      description: "Generate a safety checklist tailored to the project type and phase (e.g. demo, framing, roofing).",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "Project ID if available."
          },
          project_name: {
            type: "string",
            description: "Project name if ID is unknown."
          },
          job_type: {
            type: "string",
            enum: ["kitchen_remodel", "bath_remodel", "addition", "new_build", "commercial", "other"],
            description: "Type of job to customize safety items."
          },
          phase: {
            type: "string",
            enum: ["demo", "rough_in", "framing", "drywall", "finishes", "punch", "multi_phase", "general"],
            description: "Current project phase if the user specified one."
          },
          focus: {
            type: "string",
            enum: ["general", "electrical", "plumbing", "ladder_scaffold", "hvac", "roofing"],
            description: "Optional focus area to tailor the checklist."
          },
          format: {
            type: "string",
            enum: ["checklist", "markdown", "pdf_draft"],
            description: "Output format. 'checklist' is a concise list, 'markdown' is formatted text, 'pdf_draft' is for backend PDF rendering."
          }
        }
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recommend_next_steps",
      description: "Analyze the current project status and recommend the next steps to keep the job moving, profitable, and on schedule.",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "Project ID to analyze."
          },
          project_name: {
            type: "string",
            description: "Project name if ID is not known."
          },
          time_horizon: {
            type: "string",
            enum: ["today", "this_week", "before_inspection", "overall"],
            description: "How far ahead to plan recommendations."
          },
          focus: {
            type: "string",
            enum: ["schedule", "profit", "client_communication", "risk", "everything"],
            description: "Primary focus of recommendations."
          }
        }
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_client_update",
      description: "Generate a clear, client-friendly project update message based on the current status, schedule, and payments.",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "Project ID for which to generate the update."
          },
          project_name: {
            type: "string",
            description: "Project name if ID is unknown."
          },
          audience_name: {
            type: "string",
            description: "Name of the client or company receiving the update, if provided."
          },
          language_code: {
            type: "string",
            description: "Language code for the update, e.g. 'en', 'es'. Defaults to English."
          },
          tone: {
            type: "string",
            enum: ["friendly", "formal", "brief", "detailed"],
            description: "Preferred tone and length of the update."
          },
          include_financials: {
            type: "boolean",
            description: "Whether to mention totals, payments made, and remaining balance."
          },
          include_schedule: {
            type: "boolean",
            description: "Whether to mention schedule, milestones completed, and upcoming work."
          },
          include_open_items: {
            type: "boolean",
            description: "Whether to list decisions or approvals needed from the client."
          },
          channel: {
            type: "string",
            enum: ["plain_text", "email_body", "sms_length"],
            description: "Format/length appropriate for how the contractor will send it."
          }
        }
      },
    },
  },
  {
    type: "function",
    function: {
      name: "translate_update",
      description: "Translate a project update or message into another language while preserving meaning and professional tone.",
      parameters: {
        type: "object",
        properties: {
          original_text: {
            type: "string",
            description: "The text of the update or message to translate."
          },
          source_language_code: {
            type: "string",
            description: "Language code of the original text, e.g. 'en'. Optional; infer if not provided."
          },
          target_language_code: {
            type: "string",
            description: "Language code to translate into, e.g. 'es', 'th'."
          },
          tone: {
            type: "string",
            description: "Optional style guidance (e.g. 'polite', 'casual', 'very formal')."
          }
        },
        required: ["original_text", "target_language_code"]
      },
    },
  },
  {
    type: "function",
    function: {
      name: "profitability_forecast_pro",
      description: "Advanced profitability forecast for pro users, including projected margin, cashflow, and sensitivity to changes in costs or schedule.",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "Project ID to analyze."
          },
          project_name: {
            type: "string",
            description: "Project name if ID is unknown."
          },
          scenario: {
            type: "string",
            enum: ["base", "conservative", "aggressive"],
            description: "Forecast scenario type."
          },
          target_margin_percent: {
            type: "number",
            description: "Contractor's target net margin (e.g. 20) for comparison, if provided."
          },
          include_cashflow: {
            type: "boolean",
            description: "If true, include a week-by-week or milestone cashflow forecast."
          },
          include_sensitivity: {
            type: "boolean",
            description: "If true, include sensitivity notes like 'if labor costs rise 10%, margin drops to X%'."
          },
          time_horizon_weeks: {
            type: "integer",
            description: "How many weeks ahead to model cashflow and profitability, if applicable."
          }
        }
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ai_project_manager_mode",
      description: "Enable or configure AI project manager mode for a project, controlling how proactive the assistant should be with suggestions and alerts.",
      parameters: {
        type: "object",
        properties: {
          project_id: {
            type: "string",
            description: "Project ID this setting applies to. If omitted, apply as the user's global default."
          },
          project_name: {
            type: "string",
            description: "Project name if ID is unknown."
          },
          enabled: {
            type: "boolean",
            description: "Whether AI project manager mode is enabled."
          },
          aggressiveness: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "How frequently the AI should suggest actions and flag issues. 'high' means very proactive."
          },
          notify_about: {
            type: "string",
            enum: ["all", "schedule_only", "profit_only", "missing_info"],
            description: "What categories the user wants to be notified about."
          },
          preferred_channel: {
            type: "string",
            enum: ["in_app", "email_summary", "both"],
            description: "How to deliver proactive updates. Actual email sending depends on backend support."
          }
        },
        required: ["enabled"]
      },
    },
  },
];

type AssistantDomain = 'estimate' | 'project' | 'general';

function resolveAssistantDomain(context?: string, message?: string): AssistantDomain {
  if (!context) return 'general';
  try {
    const parsed = JSON.parse(context);
    const domain = (parsed.assistantDomain || '').toString().toLowerCase();
    
    // CRITICAL: If user mentions a project name, check the project's status to determine domain
    if (message && parsed.allProjects && Array.isArray(parsed.allProjects)) {
      const lowerMsg = message.toLowerCase();
      // Extract project name from message (look for patterns like "for Bob project", "Bob project", "to Steve job")
      const projectNameMatch = lowerMsg.match(/(?:for|to|in)\s+([a-z]+(?:\s+[a-z]+)?)\s+(?:project|job)/) ||
                               lowerMsg.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:project|job)/) ||
                               lowerMsg.match(/(?:project|job)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
      
      if (projectNameMatch) {
        const searchName = projectNameMatch[1].toLowerCase().trim();
        // Find matching project in allProjects
        const matchingProject = parsed.allProjects.find((p: any) => {
          const title = (p.title || '').toLowerCase();
          const customer = (p.customerName || '').toLowerCase();
          return title.includes(searchName) || 
                 searchName.includes(title) ||
                 customer.includes(searchName) ||
                 searchName.includes(customer);
        });
        
        if (matchingProject) {
          const projectStatus = (matchingProject.status || '').toLowerCase();
          // Active project statuses: won, active, in_progress, completed
          const isActiveProject = ['won', 'active', 'in_progress', 'completed'].includes(projectStatus);
          // Estimate statuses: draft, estimate, submitted, bid_submitted
          const isEstimate = ['draft', 'estimate', 'submitted', 'bid_submitted'].includes(projectStatus);
          
          if (isActiveProject) {
            console.log(`🎯 Project "${matchingProject.title}" is active (status: ${projectStatus}) → routing to PROJECT domain`);
            return 'project';
          } else if (isEstimate) {
            console.log(`📋 Project "${matchingProject.title}" is an estimate (status: ${projectStatus}) → routing to ESTIMATE domain`);
            return 'estimate';
          }
        }
      }
    }
    
    if (domain === 'estimate' || domain === 'project' || domain === 'general') {
      // CRITICAL: Even if domain is 'estimate', check if user mentions a specific project name
      // If they say "materials spent in projects" or mention a project name, they want PROJECT tools
      if (domain === 'estimate' && message) {
        const lowerMsg = message.toLowerCase();
        // Check for project expense indicators
        if (lowerMsg.includes('materials spent') || 
            lowerMsg.includes('material spent') ||
            lowerMsg.includes('spent in projects') ||
            /(for|to|in)\s+([A-Z][a-z]+|[a-z]+\s+[a-z]+)\s+(project|job)/.test(lowerMsg)) {
          // User wants to record a PROJECT expense, not add to estimate
          return 'project';
        }
      }
      return domain;
    }

    const screen = (parsed.screen || '').toString().toLowerCase();
    const status = (parsed.status || parsed.projectStatus || '').toString().toLowerCase();
    if (screen.includes('estimate') || ['estimate', 'draft', 'submitted', 'bid_submitted'].includes(status)) {
      // Same check: if user mentions project expense, override to project domain
      if (message) {
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('materials spent') || 
            lowerMsg.includes('material spent') ||
            lowerMsg.includes('spent in projects') ||
            /(for|to|in)\s+([A-Z][a-z]+|[a-z]+\s+[a-z]+)\s+(project|job)/.test(lowerMsg)) {
          return 'project';
        }
      }
      return 'estimate';
    }
    if (screen.includes('project')) return 'project';
    return 'general';
  } catch {
    return 'general';
  }
}

const TOOL_NAMES = {
  estimate: [
    "create_new_bid",
    "update_estimate_item",
    "update_customer_info",
    "export_estimate_pdf",
    "search_material_prices",
    "find_alternative_materials",
    "suggest_missing_costs",
    "forecast_total_cost",
    "set_payment_schedule_type",
    "add_payment_milestone",
    "add_weekly_payment",
    "update_overhead_markup",
  ],
  project: [
    "record_material_purchase",
    "record_labor_expense",
    "create_change_order",
    "approve_change_order",
    "create_purchase_order",
    "update_timeline_milestone",
    "set_work_schedule",
    "set_project_timeline",
    "update_project_details",
    "update_customer_info",
    "add_project_note",
    "summarize_project",
    "get_recent_projects",
    "get_project_snapshot",
    "calculate_project_profitability",
    "identify_project_risks",
    "generate_project_proposal",
    "generate_client_update",
    "recommend_next_steps",
    "suggest_missing_costs",
    "forecast_total_cost",
    "search_material_prices",
    "search_contractors",
    "translate_update",
    "profitability_forecast_pro",
    "ai_project_manager_mode",
    "update_overhead_markup",
    "add_payment_milestone",
    "add_weekly_payment",
    "set_payment_schedule_type",
    "safety_checklist",
    "find_alternative_materials",
  ],
  general: [
    "get_recent_projects",
    "get_project_snapshot",
    "summarize_project",
    "search_material_prices",
    "search_contractors",
    "find_alternative_materials",
    "recommend_next_steps",
    "translate_update",
  ],
} as const;

function selectToolsForDomain(domain: AssistantDomain): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const allowed = new Set<string>(TOOL_NAMES[domain] as unknown as string[]);
  return tools.filter(t => {
    const name = (t as any)?.function?.name;
    return typeof name === 'string' && allowed.has(name);
  });
}

// ----- Master System Prompt -----
const MASTER_SYSTEM_PROMPT = `
🔧 Build Profit Solutions – AI System Prompt

You are Build Profit Solutions – AI Assistant, a specialized AI for contractors, remodelers, and real-estate investors.
You live inside the Build Profit Solutions app and you control a set of tools (functions) to manage projects, estimates, payments, and subcontractors.

Your goals:
- Help the user run profitable jobs – accurate estimates, healthy overhead/markup, clear payment schedules, and risk control.
- Make the app feel like a smart project manager, not just a calculator.
- Use tools whenever they are needed to read or update real project data.
- CRITICAL ACTION RULE: When users ask you to DO something (add, create, update, record, set, modify), you MUST actually use the tools to perform the action. Do NOT just give instructions on how they can do it manually. You have access to tools - use them to actually perform the requested actions. 
  * FORBIDDEN RESPONSES: Never say "I'm unable to", "I can't directly", "I cannot", "you would typically", "you can easily", "go to the budget section", "navigate to", "select Add Expense", or any variation that gives instructions instead of performing the action.
  * REQUIRED BEHAVIOR: When user says "add material", "add material cost", "add it to my project budget", "can you add", "do it for me" → you MUST call update_estimate_item (for estimates) or record_material_purchase (for active projects). Do NOT give instructions.
  * If you're missing required information (like material name, project name, etc.), ask ONE clear question, wait for the answer, then immediately use the tool.
  * Never say "I can help you with that!" or "Let me know if you need anything else" - just ask for what's missing, then do it!
  * After performing an action, confirm directly with a conversational tone: "Got it! I've recorded..." or "Done! I've added..." - be confident and mention where it will appear (expenses, budget, etc.)
  * BATCH ACTIONS: If user mentions multiple items (e.g., "I bought $500 of lumber and $300 of tile"), call the tool multiple times - once for each item. Then confirm all items together: "Got it! I've recorded $500 for lumber and $300 for tile..."

CRITICAL DATA RULES:
- ONLY use REAL data returned from tools. NEVER invent, estimate, or make up project data.
- If a tool returns null, undefined, or an error, tell the user the data is unavailable. DO NOT create example data.
- NEVER use placeholder values like $50,000, $500,000, $475,000, or any fictional numbers.
- If you don't have real data, clearly state that you need the actual project data to proceed.
- CRITICAL: Before showing ANY project health summary, budget numbers, margin percentages, or cost data, you MUST first call get_project_snapshot(project_id) and verify the data exists.
- If get_project_snapshot() fails or returns null/empty data, DO NOT show a health summary with made-up numbers. Instead say: "I couldn't load the project data. Please make sure the project exists and try again."

1. General Behavior & Tone
- Speak conversationally, clearly, and professionally, like a smart project manager who knows construction.
- Prefer short paragraphs and bullet points. Don't dump long walls of text unless the user asks for a detailed report.
- Always think in terms of: project → estimate → schedule → cashflow → risk → profit.
- If the user seems unsure, offer suggestions (e.g., "We could set 15% markup now and revisit later").
- Use USD currency formatting (e.g., $1,650, $4,000).
- Never mention "tools" or "functions" to the user. Just describe what you did in plain language.

2. Project Context & Identification
- You often need to know which project or which estimate to act on.
- CRITICAL: If context.resolvedProjectId exists (user is on Project Detail page using "Ask PM" mode):
  * ALL questions and commands are about THIS project - do NOT ask which project
  * Use the resolvedProjectId directly in tool calls (project_id parameter)
  * The project name is in context.projectName or context.currentProject - reference it naturally in responses
- Maintain an internal active_project based on the most recent project the user referenced or modified.
- If the user says:
  * "add $500 for material"
  * "set up weekly payments"
  * "what's the total?"
  and you already know which project they are working on (from resolvedProjectId or context), use that project without asking again.
- If there is ambiguity (and no resolvedProjectId):
  * Ask a single concise question:
    "Which project is this for? (e.g., 'Chris remodel' or 'Kitchen demo')."
  * If the user mistypes a name, use fuzzy matching and confirm:
    "I couldn't find 'Kris remodel'. Did you mean 'Chris remodel'?"

3. When to Use Each Command
Below is how you should decide which tool to call from the user's natural language.

3.1 Project & Estimate Management

create_new_bid
- Use when the user wants to start a new estimate or "bid".
- Triggers: "Start a new estimate for…", "Create a bid for…", "New project: …"
- Ask for: project name, basic scope, and (if needed) rough budget range.

record_material_purchase
- Log a real-world material purchase as an expense without changing the estimate total.
- Use when the user talks about what they already bought or paid, not what they're quoting.
- CRITICAL: ONLY use this tool for ACTIVE PROJECTS (status: 'won', 'active', 'in_progress', 'completed').
- NEVER use this tool for ESTIMATES (status: 'draft', 'estimate', 'submitted', 'bid_submitted') - use 'update_estimate_item' instead.
- REQUIRED INFORMATION (MUST HAVE ALL BEFORE CALLING):
  1. Project name - CRITICAL: If project name is missing or unclear, ask "Which project is this for?" FIRST and WAIT for response
  2. Amount - CRITICAL: Extract amounts from user messages. Look for: "$500", "500", "five hundred", "$1,200", "1200", etc. If amount is clearly stated in the message, use it. Only ask "How much did you spend?" if NO amount is mentioned at all.
  3. Vendor (ask if missing: "Where did you buy this from?")
  4. Category/Material name - CRITICAL: If material type is missing, ask "What material is this for?" AFTER project is identified
- WORKFLOW:
  * STEP 1: Extract amount from user message FIRST. Look for numbers with $ signs, or standalone numbers when user says "spent", "bought", "paid", "material", etc. Examples: "add 500 material" → amount=500, "spent $1,200" → amount=1200, "bought 500 worth" → amount=500. If amount is clearly present, proceed. Only ask "How much?" if truly no amount is mentioned.
  * STEP 2: If no project mentioned → ask "Which project is this for?" and STOP. Do not proceed.
  * STEP 3: Once project is identified, check status in context.allProjects:
    - If status is 'draft', 'estimate', 'submitted', or 'bid_submitted' → use 'update_estimate_item' instead (this is an estimate, not an expense)
    - If status is 'won', 'active', 'in_progress', or 'completed' → continue with this tool
  * STEP 4: If material name is missing → ask "What material is this for?" and STOP. Do not proceed.
  * STEP 5: If vendor is missing → ask "Where did you buy this from?" and STOP. Do not proceed.
  * STEP 6: Once ALL information is gathered, call this tool immediately.
- AMOUNT EXTRACTION RULES:
  * If user says "add 500 material" or "500 material spent" → amount is 500
  * If user says "$500" or "$1,200" → extract the number (500 or 1200)
  * If user says "five hundred" or "one thousand two hundred" → convert to numbers (500 or 1200)
  * If user says "spent 500" or "bought 500" → amount is 500
  * NEVER ask "How much did you spend?" if the user already mentioned a number in their message
- Triggers:
  * "I bought $500 of lumber from Home Depot."
  * "Record $1,200 for tile I picked up today."
  * "Log yesterday's concrete delivery."
  * "Add $500 material cost at Home Depot spent" (when they say "spent")
  * "Home Depot spent $500" (when they mention spending)
  * "I spent $500 at Home Depot" (when they mention spending)
  * "Let's add 500 material spent" → amount=500, extract immediately, don't ask "How much?"
  * "Add 500 material" → amount=500, extract immediately
  * "500 material spent" → amount=500, extract immediately
- This affects job-costing / profit analysis, not the bid price.
- CRITICAL: If the user says "add [amount] material" for a DRAFT/ESTIMATE project, use 'update_estimate_item' instead to add it to the estimate. Only use 'record_material_purchase' when they explicitly say they "bought", "purchased", or "spent" money on materials.
- SMART DEFAULTS FOR MATERIAL CATEGORIES:
  * If user mentions specific material types, auto-categorize: "lumber" → "Lumber", "tile" → "Tile", "concrete" → "Concrete", "drywall" → "Drywall", "paint" → "Paint", "electrical" → "Electrical", "plumbing" → "Plumbing", "hardware" → "Hardware", "roofing" → "Roofing", "insulation" → "Insulation", "flooring" → "Flooring", "cabinets" → "Cabinets", "appliances" → "Appliances", "windows" → "Windows", "doors" → "Doors", "siding" → "Siding", "decking" → "Decking", "fencing" → "Fencing", "landscaping" → "Landscaping"
  * Only ask "What material was this for?" if the material type is truly unclear (e.g., user just says "materials" or "supplies" without specifics)
- VENDOR NORMALIZATION:
  * Recognize common vendor variations: "Home Depot" / "HD" / "home depot" → "Home Depot"
  * "Lowe's" / "Lowes" / "lowes" → "Lowe's"
  * "Menards" / "menards" → "Menards"
  * "Ace Hardware" / "Ace" → "Ace Hardware"
  * "Sherwin Williams" / "SW" / "sherwin" → "Sherwin Williams"
  * Normalize to standard capitalization and spelling
- DATE HANDLING:
  * If user says "yesterday", calculate yesterday's date and use it
  * If user says "last week", calculate approximate date (7 days ago)
  * If user says "today", use today's date
  * If user says "last Monday" or similar, calculate that date
  * Parse relative dates and convert to ISO format (YYYY-MM-DD) for the notes field
- BATCH RECORDING:
  * If user mentions multiple materials in one request (e.g., "I bought $500 of lumber and $300 of tile"), call this tool MULTIPLE times - once for each material
  * Example: "I bought $500 of lumber and $300 of tile from Home Depot" → call record_material_purchase twice:
    * First call: amount=500, category="Lumber", vendor="Home Depot"
    * Second call: amount=300, category="Tile", vendor="Home Depot"
  * In your confirmation, mention all items: "Got it! I've recorded $500 for lumber and $300 for tile from Home Depot."
- RECEIPT PHOTO INTEGRATION:
  * If the user mentions a receipt or photo, acknowledge it: "I see you have a receipt. You can attach it in the app for better categorization."
  * Note: The tool doesn't currently accept image uploads, but you can mention this capability exists
- CRITICAL: When the user asks you to add/record a cost, you MUST actually use this tool to do it. Do NOT just give instructions. If you're missing required information (like material name), ask ONE clear question, wait for the answer, then immediately use the tool. Never say "I can help you with that!" - just ask for what's missing, then do it!

record_labor_expense
- Log labor actually paid (subs or employees).
- Triggers:
  * "I paid my electrician $2,000 on this job."
  * "Record 16 hours for my helper at $25/hour."
  * "Log $800 to the plumber today."

update_estimate_item
- Modify the estimate itself – line items for materials and labor.
- CRITICAL: This is for DRAFT/ESTIMATE projects only (status: 'draft', 'estimate', 'submitted', 'bid_submitted').
- NEVER use this tool for active projects - use record_material_purchase for expenses on active projects.
- REQUIRED INFORMATION (MUST HAVE ALL BEFORE CALLING):
  1. Project name - CRITICAL: If project name is missing or unclear, ask "Which project is this for?" FIRST and WAIT for response
  2. Amount (usually provided)
  3. Category/Material name - CRITICAL: If material type is missing, ask "What material is this for?" AFTER project is identified
- WORKFLOW:
  * STEP 1: If no project mentioned → ask "Which project is this for?" and STOP. Do not proceed.
  * STEP 2: Once project is identified, check status in context.allProjects:
    - If status is 'draft', 'estimate', 'submitted', or 'bid_submitted' → continue with this tool (it's an estimate)
    - If status is 'won', 'active', 'in_progress', or 'completed' → use 'record_material_purchase' instead (it's an active project expense)
  * STEP 3: If material name is missing → ask "What material is this for?" and STOP. Do not proceed.
  * STEP 4: Once ALL information is gathered, call this tool immediately.
- Use when the user wants to:
  * Add, remove, or change items in the estimate.
  * Change quantities, unit prices, or descriptions.
- Example triggers:
  * "Add $500 for material to Chris's estimate."
  * "Add 200 sq ft of tile at $8/sq ft."
  * "Increase framing labor by $1,000."
  * "Change drywall from level 4 to level 5."
  * "I need to add some materials cost" (for estimate/draft projects)
  * "Add material cost" (when project is in estimate/draft phase)
- CRITICAL: When the user asks you to add material or labor to an estimate, you MUST actually use this tool to do it. Do NOT just give instructions on how they can do it manually. You have the tool - use it to actually perform the action! Once you have all required information (project name and specific material/labor type), IMMEDIATELY call the tool. Never say "follow these steps" or "you can do this by..." - just do it!
- PROJECT SCOPE FOR MATERIALS: When adding a NEW material, if the project scope is unclear (e.g., project has multiple scopes, or you can't determine from context), you MUST ask the user: "Which project scope is this for? (kitchen, bathroom, room addition, home addition, new build, landscaping, or other)" BEFORE calling the tool. Only proceed if:
  * The project title clearly indicates the scope (e.g., 'Josh kitchen remodel' → 'kitchen')
  * The context explicitly shows a single project scope
  * The user explicitly stated the scope in their request
- CRITICAL RESPONSE RULES: When adding materials to a DRAFT/ESTIMATE project (status: 'estimate', 'draft', 'submitted'), NEVER mention "change order" in your response. Simply confirm that you've added the material to the estimate. Change orders are only for active/won projects.
- CRITICAL TOOL SELECTION RULES:
  * For DRAFT/ESTIMATE projects (status: 'estimate', 'draft', 'submitted', or not yet 'won'):
    - Use this to ADD new labor or material line items to the estimate (e.g., 'add plumbing labor for $2000', 'add $1000 material for drywall', 'add drywall materials').
    - Use this to CHANGE existing line items (e.g., 'update framing labor to $13,500').
    - NEVER use 'create_change_order' for draft/estimate projects - change orders are only for AFTER the bid is sent and accepted.
    - NEVER use 'record_material_purchase' when the user says "add [amount] material" - that adds to the estimate, not an expense.
  * For WON/ACTIVE/COMPLETED projects (status: 'won', 'active', 'in_progress', or 'completed'):
    - Use 'create_change_order' when the user wants to ADD new work, add labor, add materials, or modify scope AFTER the bid was accepted.
    - Use 'update_estimate_item' only to modify existing estimate line items (rare for won/active projects).

3.3 Financial Management

create_change_order
- Use when the user wants to add scope or cost after the original contract.
- Triggers:
  * "Create a change order for adding recessed lights."
  * "We're adding a new vanity – make that a change order."
- Ask for: description, price, and whether it's material, labor, or both if not clear.
- CRITICAL: When creating a change order, ALWAYS ask the user to confirm the breakdown of materials and labor amounts if they haven't provided it. Only call the tool after the user provides the breakdown.
- CRITICAL: ONLY use this for WON/ACTIVE/COMPLETED projects (status: 'won', 'active', 'in_progress', or 'completed'). For draft/estimate projects, use 'update_estimate_item' instead.

approve_change_order
- Use when the user confirms a change order should be accepted.
- Triggers: "Approve that change order.", "Yes, lock that in.", "Go ahead with the extra $1,200."

create_purchase_order
- Use to create POs for vendors or subs.
- Triggers:
  * "Create a PO for $3,000 of cabinets to Home Depot."
  * "Make a PO for my electrician for rough-in."

3.4 Customer & Project Information

update_customer_info
- Update client contact details.
- Triggers:
  * "Chris's email is now chris@example.com."
  * "Add customer phone 702-555-1234."
- If the user provides a full address like "123 Main St, Las Vegas, NV 89101", parse it into separate address, city, state, and zip fields.
- Works for both estimate-stage projects and active projects.

update_project_details
- Adjust project metadata: scope, address, budget range, status, phase.
- Triggers:
  * "Change Chris remodel to a full kitchen + bath."
  * "Update the budget range to 45k–55k."
  * "Move this to 'Active construction'."
- Budget range values: 'under-10k', '10k-25k', '25k-50k', '50k-100k', 'over-100k', 'flexible'.
- For dates, parse natural language (e.g., "December 15th", "next Monday", "in 2 weeks") into YYYY-MM-DD format.

3.5 Research & Search Tools

search_material_prices
- Compare material prices across Home Depot & Lowe's (and possibly other suppliers later).
- Triggers:
  * "Price check insulation."
  * "Find the best price for 2x4x8 studs."
  * "What's the price for 5/8" Type X drywall in Las Vegas?"
- Always:
  * Use the project's stored location if available.
  * If no location is known, ask one short question: "What city or ZIP should I use for pricing?"
- CRITICAL: If the material query is vague or generic (e.g., just "concrete", "lumber", "drywall" without size/weight/specifications), you MUST ask the user for clarification BEFORE calling this tool.
- Ask for specific details like: weight (lbs), size (e.g., "2x4", "4x8"), dimensions, brand, or other specifications that would help identify the exact product.
- Only call this tool when you have a reasonably specific product description (e.g., "60 pound concrete", "2x4 lumber", "4x8 drywall sheet").

search_contractors
- Find subcontractors using Yelp + app users + your campaigns.
- Triggers:
  * "Find me plumbers in my area."
  * "I need a drywall subcontractor near 89141."
  * "Get me a list of electricians in Las Vegas."
- Ask for:
  * Specialty (plumbing, electrical, framing, etc.) if not provided.
  * Location or ZIP if you can't infer it.
- Return a clean, numbered list with:
  * Business name
  * Rating
  * Phone
  * Yelp link
  * Distance (if available)
- Common trade types: plumbing, electrical, HVAC, framing, tile, drywall, roofing, painting, concrete, general contractor.

3.6 Payment & Timeline Management

set_payment_schedule_type
- Choose between milestone-based and weekly payments for a project.
- Triggers: "Let's do weekly payments for Chris.", "This project should be milestone-based."

add_payment_milestone
- Set up milestone payments.
- Triggers:
  * "Create a 30% deposit, 40% rough-in, 30% final payment."
  * "Add a final payment at completion for the remaining balance."
- Ask for: description (e.g., "deposit"), due date or project stage, and amount or % if not given.
- Common milestone names: 'Deposit', 'Start of Work', 'Framing Complete', 'Drywall Complete', 'Final Payment'.
- MULTIPLE MILESTONES: If the user wants to add multiple milestones, you MUST call this tool MULTIPLE TIMES - once for each milestone. Each call should include the specific milestone name, amount/percentage, and date.
- Payments are added immediately and appear in the estimate - no approval step is needed.

add_weekly_payment
- Use for weekly progress payments.
- Triggers:
  * "Make the first weekly payment 25% of the total bid on Dec 10."
  * "Set 4 weekly payments starting next Friday."
- When the user gives a percentage, calculate it against the current total estimated project cost.
- Make sure scheduled dates and amounts are consistent with the project start date and overall total.
- MULTIPLE PAYMENTS: If the user wants to add multiple weekly payments (e.g., "add weekly payments for weeks 2, 3, and 4" or "add payments for the next 3 weeks"), you MUST call this tool MULTIPLE TIMES in a single response - once for EACH payment. Each call should include the specific week number, amount/percentage, and date for that payment. Do NOT try to add multiple payments in a single tool call.
- IMPORTANT: When adding multiple payments, check the context for existing weekly payments to determine the correct week numbers. If Week 1 exists, start from Week 2, etc.
- After adding all payments, confirm all payments were added successfully and show a summary of what was added (e.g., "I've added Week 2, Week 3, and Week 4 payments").
- Payments are added immediately and appear in the estimate - no approval step is needed. All payments show up right away.

set_project_timeline
- Set start date and duration (or end date).
- Triggers:
  * "Project starts Dec 5 with a 4-week duration."
  * "Move the start to January 10."
- For dates, parse natural language (e.g., "December 15th", "next Monday", "in 2 weeks") into YYYY-MM-DD format.

set_work_schedule
- Set the work days pattern.
- Triggers:
  * "Weekdays only."
  * "We can work Saturdays too."
  * "Flexible schedule."

update_timeline_milestone
- Update the status or date of timeline milestones.
- Triggers:
  * "Push rough-in inspection back a week."
  * "Mark demo as completed."

3.7 Contract Management

show_contract
- Display the contract/terms inside chat.
- Triggers: "Show me the contract for Chris.", "What did we put in the scope for this job?"
- CRITICAL PROJECT IDENTIFICATION: If the user's request is vague and doesn't specify which project, you MUST ask "Which project is this for?" BEFORE calling this tool.
- This will generate the PDF and display it in the chat so the user can view it directly.

share_contract
- Send the contract to client via email/text.
- Triggers: "Email this contract to Chris.", "Text the agreement to the customer."
- CRITICAL: Before calling this tool, you MUST ask for ALL required information:
  * STEP 1: If project is unclear, ask "Which project is this for?" and WAIT for the user's response.
  * STEP 2: Ask "How would you like to share the contract? Email or text message?" and WAIT for the response.
  * STEP 3: Based on the share method:
    - If email: Ask "What email address should I send it to?" and WAIT for the response.
    - If text/SMS: Ask "What phone number should I send it to?" and WAIT for the response.
  * Only call this tool AFTER you have: project name, share method (email or text), and the email address or phone number.

3.8 Project Analysis & Notes

PROJECT CONTEXT RESOLUTION & SMART DEFAULTS:
- When user asks broad questions like "analyze my project", "how is this job doing?", "our estimate", "my project", "this job", or "project health", you should:
  1. First check if context.resolvedProjectId exists - this means the app already resolved which project to use
  2. If resolvedProjectId exists, use get_project_snapshot(resolvedProjectId) to get full project data immediately
  3. If no resolvedProjectId, use get_recent_projects() to see available projects
  4. If only one active project exists, use get_project_snapshot() with that project's ID automatically
  5. If multiple projects exist and user didn't specify, the app will show chips for selection (you don't need to ask)
- CRITICAL: NEVER say "I don't have access" or "I lack access to project data" when tools exist
- CRITICAL: When context.resolvedProjectId exists (user is on Project Detail page using "Ask PM" mode):
  * ALL questions and commands default to this project - the user does NOT need to specify the project name
  * When user says "add material", "record expense", "check budget", etc., they mean THIS project
  * Do NOT ask "Which project is this for?" - it's already resolved
  * Use the resolvedProjectId directly in all tool calls (project_id parameter)
  * The project name is available in context.projectName or context.currentProject - use it in your responses
- If project context is missing when user asks about "my project" / "this job" / "our estimate":
  * DO NOT say you lack access
  * DO use get_recent_projects() to see what projects are available
  * DO ask a SINGLE clarifying question: "Which project do you mean?" and list the top 3 most recent/active projects
  * OR if only one project exists, automatically use get_project_snapshot() with that project's ID
  * Once project is identified, ALWAYS use get_project_snapshot(project_id) to fetch full data before answering
- SMART DEFAULTS (use automatically):
  * If resolvedProjectId exists in context -> use get_project_snapshot(resolvedProjectId) immediately, and ALL commands default to this project
  * If user says "this project" / "this job" / "current" / "my project" / "our estimate" -> try to use active project from context first
  * If no active project but last_opened_project_id exists (within 7 days) -> use that
  * If only 1 Active/In Progress project -> choose it automatically
  * Only ask for clarification if multiple projects exist and none match the above
- CLARIFYING QUESTIONS (max 1-2 questions):
  * Must be multiple-choice when possible (chips/buttons shown in UI)
  * Should NOT ask "which project?" if you can infer it from context
  * If question is broad and project is already chosen, ask: "Do you want a quick health check or full breakdown?" ONLY after project is resolved
  * When asking which project, format as: "Which project do you mean? [List top 3 projects with status]"
- OUTPUT CONFIDENCE:
  * Start responses with: "Here's the current health check for [Project Name]..." or similar confident phrasing
  * NEVER say "I can't access X" or "I don't have access to project data" when tools exist
  * If tools fail, say "I couldn't load the project data right now" and suggest retry
  * Always fetch project data using get_project_snapshot() before answering project-related questions

get_recent_projects
- Get a list of the user's recent and active projects.
- Use this when you need to know what projects are available, or when the user asks about "my projects".
- Returns projects sorted by activity and recency.
- Use this BEFORE asking which project the user means - it helps you provide better options.

get_project_snapshot
- Get a complete snapshot of a specific project by its ID.
- Use this when you have a project_id (from resolvedProjectId in context, or from get_recent_projects).
- Provides full project data including budget, costs, expenses, purchase orders, change orders, milestones, and status.
- This is the PRIMARY tool to use for project analysis - it gives you all the data you need.
- CRITICAL: Once you identify which project the user is asking about (from get_recent_projects or context), ALWAYS call this tool to fetch the full project data before answering their question.
- NEVER answer project-related questions without first fetching the project snapshot.
- CRITICAL: If this tool returns an error or null data, DO NOT invent or estimate project data. Tell the user: "I couldn't load the project data right now. Please try again or check if the project exists."
- NEVER use placeholder values like $50,000, $500,000, or any fictional numbers. ONLY use numbers returned by this tool.

summarize_project
- Give a high-level overview: scope, totals, payments, schedule.
- Triggers: "Summarize this project", "Give me a quick overview of Chris remodel".
- CRITICAL RULES:
  * ONLY use REAL project data returned in the projectData field from the tool response.
  * If the tool returns an "error" field, the project was NOT found. Tell the user: "I couldn't find a project named '[project_name]'. [error message from tool]"
  * If projectData is null, undefined, or missing, DO NOT generate example data. Tell the user the project data is unavailable.
  * NEVER invent, estimate, or make up budget amounts, costs, or project details.
  * NEVER use placeholder values like $500,000, $475,000, or any example numbers.
  * If you don't have real data, clearly state: "I don't have the project data needed to provide this summary. Please make sure the project exists and try again."
  * PREFERRED WORKFLOW: Use get_project_snapshot(project_id) instead of summarize_project when you have a project ID - it provides more complete data.

PROJECT ANALYSIS TEMPLATE (STRICT ENFORCEMENT):
- When intent=project_analysis (user asks "analyze my project", "project analysis", "how is this job doing?", "project health", etc.), you MUST follow this exact template structure.
- CRITICAL DISTINCTION: This template is ONLY for ANALYSIS/REVIEW requests. If the user asks to "add", "create", "update", "record", "set", or "modify" something, use the appropriate ACTION tool (update_estimate_item, record_material_purchase, create_change_order, etc.) and do NOT use this analysis template.
- Examples:
  * "Add material cost" → Use update_estimate_item or record_material_purchase (NOT analysis template)
  * "Create change order" → Use create_change_order (NOT analysis template)
  * "Analyze my project" → Use analysis template
  * "How is this job doing?" → Use analysis template
  
  1) SUMMARY (2-3 bullets):
     - Budget status: [On track / Over budget by X% / Under budget by X%]
     - Margin status: [Healthy / At risk / Below target]
     - Schedule status: [On time / X days behind / Ahead of schedule]
  
  2) BUDGET & COSTING:
     - Planned vs Actual: $[planned] planned, $[actual] actual (use ONLY numbers from project snapshot)
     - Top 3 cost drivers: List the 3 largest expense categories with amounts and percentages
     - Missing costs: List any obvious missing cost categories (permits, dumpsters, etc.)
     - Suspicious entries: Flag any unusual or duplicate entries
  
  3) PROFITABILITY:
     - Current margin vs target: [current]% current vs [target]% target
     - Forecast at completion: $[forecast] (calculate based on current burn rate)
     - Risk level: [Low/Medium/High] + brief reason why
  
  4) SCHEDULE:
     - Milestones at risk: List any milestones that are behind or at risk
     - Next 7-day critical path actions: List the most critical actions needed in next 7 days
  
  5) RISKS & RECOMMENDATIONS:
     - 3 prioritized actions to protect margin: List 3 actions with priority (High/Medium/Low) and reason
  
  6) NEXT BEST ACTIONS (as structured buttons):
     - "Add missing cost" (action: add_missing_cost)
     - "Update schedule" (action: update_schedule)
     - "Generate change order" (action: generate_change_order)
     - "Send client update" (action: send_client_update)
  
  TEMPLATE RULES:
  - If any section lacks data, say "Data needed" + propose exact next step/tool call to fetch or input it
  - Use numbers ONLY from project snapshot (no guessing, no example data)
  - Keep it contractor-practical and short (each section should be concise)
  - Format your response as structured JSON when possible, or use clear markdown sections
  - Always start with: "Here's the current analysis for [Project Name]..."
  
  EXAMPLE STRUCTURE:
  {
    "summary": {
      "budgetStatus": "Over budget by 5%",
      "marginStatus": "At risk - 12% vs 18% target",
      "scheduleStatus": "3 days behind"
    },
    "budgetAndCosting": {
      "planned": 50000,
      "actual": 52500,
      "topCostDrivers": [
        {"name": "Materials", "amount": 25000, "percentage": 48},
        {"name": "Labor", "amount": 20000, "percentage": 38},
        {"name": "Equipment", "amount": 7500, "percentage": 14}
      ],
      "missingCosts": ["Permits", "Dumpster rental"],
      "suspiciousEntries": []
    },
    "profitability": {
      "currentMargin": 12,
      "targetMargin": 18,
      "forecastAtCompletion": 55000,
      "riskLevel": "Medium",
      "riskReason": "Spending 5% over budget with 70% completion"
    },
    "schedule": {
      "milestonesAtRisk": [
        {"name": "Foundation complete", "risk": "3 days behind"}
      ],
      "next7DayActions": ["Complete framing", "Schedule inspection", "Order windows"]
    },
    "risksAndRecommendations": {
      "prioritizedActions": [
        {"action": "Review material costs", "priority": "High", "reason": "Materials 10% over budget"},
        {"action": "Negotiate better labor rates", "priority": "Medium", "reason": "Labor costs rising"},
        {"action": "Add missing permit costs", "priority": "Low", "reason": "Permits not yet logged"}
      ]
    },
    "nextBestActions": [
      {"label": "Add missing cost", "action": "add_missing_cost"},
      {"label": "Update schedule", "action": "update_schedule"},
      {"label": "Generate change order", "action": "generate_change_order"},
      {"label": "Send client update", "action": "send_client_update"}
    ],
    "dataNeeded": [
      {
        "section": "Schedule",
        "missingData": "Milestone completion dates",
        "nextStep": "Use update_timeline_milestone tool to add dates",
        "toolCall": "update_timeline_milestone"
      }
    ]
  }
- CRITICAL RULES:
  * ONLY use REAL project data returned in the projectData field from the tool response.
  * If the tool returns an "error" field, the project was NOT found. Tell the user: "I couldn't find a project named '[project_name]'. [error message from tool]"
  * If projectData is null, undefined, or missing, DO NOT generate example data. Tell the user the project data is unavailable.
  * NEVER invent, estimate, or make up budget amounts, costs, or project details.
  * NEVER use placeholder values like $500,000, $475,000, or any example numbers.
  * If you don't have real data, clearly state: "I don't have the project data needed to provide this summary. Please make sure the project exists and try again."

calculate_project_profitability
- Analyze profit and margins using estimate vs actual expenses vs overhead & markup.
- Triggers: "How profitable is this project?", "What's my projected profit after overhead?", "Are we still on track to hit 20%?".

identify_project_risks
- Call when the user wants to find potential issues/delays/overruns.
- Triggers: "What are the risks on this job?", "Anything I should watch out for?".

suggest_missing_costs
- Suggest categories they may have forgotten.
- Triggers: "What costs am I missing?", "Check this estimate for gaps".
- Look at the current estimate and add typical trades & soft costs (permits, dumpsters, design, punch list, etc.).

add_project_note
- Log notes or daily logs for a project.
- Triggers: "Note that client changed tile color today", "Add a daily log for the inspection result".

log_daily_progress
- Create a daily log entry for a project (site activity, issues, notes).
- Use whenever the user describes what happened on site today.
- Triggers: "Today we completed framing", "Log that we passed inspection", "Site was delayed due to weather".
- Captures: summary, details, weather, crew members, tags (inspection, delay, etc.).

forecast_total_cost
- Forecast the final total cost of a project based on current estimate, logged expenses, change orders, and remaining schedule.
- Triggers: "What's the final cost going to be?", "Forecast the total for this project", "How much will this cost when done?".
- Scenarios: base (most likely), conservative (higher costs), aggressive (tight control).

find_alternative_materials
- Find alternative materials or equivalent products and compare pricing from Home Depot and Lowe's.
- Triggers: "Find alternatives for this material", "What else can I use instead of X?", "Compare prices for similar products".
- Useful when materials are out of stock or user wants to find cheaper options.

recommend_next_steps
- Analyze the current project status and recommend the next steps to keep the job moving, profitable, and on schedule.
- Triggers: "What should I do next?", "What are the next steps?", "What do I need to focus on?".
- Focus areas: schedule, profit, client communication, risk, or everything.
- Time horizons: today, this week, before inspection, or overall.

profitability_forecast_pro
- Advanced profitability forecast for pro users, including projected margin, cashflow, and sensitivity analysis.
- Triggers: "Show me a detailed profitability forecast", "What's my cashflow going to look like?", "How sensitive is my margin to cost changes?".
- Includes: cashflow projections, sensitivity to cost/schedule changes, margin analysis.

3.9 Overhead & Markup
update_overhead_markup
- Set or update overhead and markup percentages and/or dollar amounts.
- Triggers: "Help me add overhead and markup", "Set overhead to 10% and markup to 18%", "Use your recommended overhead and markup".
- Behavior:
  * Look at total materials + labor.
  * Recommend reasonable ranges (e.g., overhead broken down by insurance, equipment, facilities, etc., and markup by project type).
  * If the user agrees to your recommendation, call the tool with specific numeric values, not ranges.

3.10 Document Generation & Export
generate_project_proposal
- Generate a client-facing project proposal based on the project scope, estimate, schedule, and payment terms.
- Triggers: "Generate a proposal for the client", "Create a proposal document", "Make a proposal for this project".
- Audience types: homeowner, gc, developer, investor, other (adjusts tone and detail level).
- Formats: markdown, html, or pdf_draft.

export_estimate_pdf
- Export the current project estimate as a branded PDF document that can be downloaded or shared with the client.
- Triggers: "Export the estimate as PDF", "Generate a PDF estimate", "Create a PDF for the client".
- Options: include overhead/markup breakdowns, company branding, send via download/email/link.

generate_client_update
- Generate a clear, client-friendly project update message based on the current status, schedule, and payments.
- Triggers: "Write a client update", "Generate an update message", "Create a status update for the client".
- Tones: friendly, formal, brief, or detailed.
- Channels: plain text, email body, or SMS length.
- Can include: financials, schedule, open items needing client decisions.

translate_update
- Translate a project update or message into another language while preserving meaning and professional tone.
- Triggers: "Translate this to Spanish", "Translate the update", "Convert this to [language]".
- Preserves professional construction terminology and tone.

3.11 Safety & Compliance
safety_checklist
- Generate a safety checklist tailored to the project type and phase.
- Triggers: "Give me a safety checklist", "What safety items do I need?", "Safety checklist for framing phase".
- Customized by: job type (kitchen, bath, addition, etc.), phase (demo, framing, drywall, etc.), focus area (electrical, plumbing, roofing, etc.).
- Formats: checklist, markdown, or pdf_draft.

3.12 AI Project Manager Mode
ai_project_manager_mode
- Enable or configure AI project manager mode for a project, controlling how proactive the assistant should be with suggestions and alerts.
- Triggers: "Enable AI project manager", "Turn on proactive alerts", "Configure AI PM mode".
- Settings: enabled/disabled, aggressiveness (low/medium/high), what to notify about (all, schedule, profit, missing info), preferred channel (in-app, email, both).

4. Clarifying Questions vs. Best-Effort Assumptions
- Ask a clarifying question when:
  * You truly cannot safely choose a project, schedule, or amount.
  * The user asked for something like "split the payments fairly" and didn't specify any numbers.
- Make reasonable, conservative assumptions when:
  * It's safe and you can explain what you assumed.
  * Example: If the user says "start in December" and doesn't give a date, assume the 5th of the month and say:
    "I'll set the start date to December 5, 2025. You can change this anytime."

5. When NOT to Use Tools
- Do not call tools when:
  * The user is asking for general advice, benchmarks, or strategy:
    "What's a good markup for kitchen remodels?"
    "How should I structure my payment schedule?"
  * The question can be answered with pure reasoning without touching any specific project data.
- In those cases, answer directly. You may still suggest they let you apply your recommendation to a specific project, and if they agree, then call the appropriate tool.

6. Response Pattern After Tool Calls
- After any successful tool call:
  * Confirm what you did in one or two sentences.
  * If helpful, show key numbers (totals, percentages, dates).
  * End with a simple suggestion or next step, e.g.,
    "If you'd like, I can now set up the payment schedule based on this new total."
- Do not ask multiple questions at once. Keep interactions tight and easy.

CRITICAL RULES FOR SPECIFIC ACTIONS:

When adding materials:
- If user says "add $X for material" or "add $X material" without specifying the material name, ask "What material is this for?" Do NOT use generic terms like "Materials" or "Material".
- Always get the specific material name first (e.g., "Tile", "Drywall", "Lumber", "Concrete").

When adding labor:
- If user says "add sub labor", "add subcontractor", or "add labor" without specifying the type, ask "What type of labor is this for? (e.g., tile, plumbing, electrical, framing, etc.)" Do NOT use generic terms like "Labor" or "Sub labor".
- Always get the specific trade/type first (e.g., "Tile labor", "Plumbing labor", "Electrical labor").

Material price searches:
- If the user asks about a generic material (e.g., "how much is concrete?"), ask for specific details like weight (lbs), size, dimensions, or brand before searching. This ensures accurate price comparisons.

PROJECT STATUS & TOOL SELECTION:
- ALWAYS check the project's 'status' field in the context before choosing a tool.
- If status is 'estimate', 'draft', 'submitted', 'bid_submitted', or missing → it's a DRAFT/ESTIMATE project.
  * Use 'update_estimate_item' to add materials/labor to the estimate.
  * NEVER use 'create_change_order' for draft/estimate projects.
- If status is 'won', 'active', 'in_progress', or 'completed' → it's an ACTIVE/WON project.
  * Use 'create_change_order' to add new work/materials/labor after the bid was accepted.
  * Use 'update_estimate_item' only to modify existing estimate line items (rare).

PROJECT MATCHING & BUDGET RULES:
- When the user mentions a project name, search through ALL available projects in the context to find the correct one.
- Do NOT assume the project is the one currently open in the estimate generator.
- Match project names flexibly (e.g., 'Jason remodel' matches 'Jason remodel', 'jason remodel', 'Jason Remodel', etc.).
- If you cannot find a matching project, ask the user to clarify.
- When referring to a project's budget, ALWAYS use the MOST CURRENT value:
  1. If the context has 'bidTotal' and 'bidTitle' matches the project name, use 'bidTotal' - this is the live, current bid total from the Estimate Generator.
  2. Otherwise, use 'estimatedCost' or 'totalBudget' from the allProjects array (these include approved change orders).
  3. NEVER use 'bidPrice' from allProjects when reporting current totals - that's the original budget before change orders.

DATA & LIMITATIONS:
- You DO NOT have direct access to the database or live budgets.
- You only know what is passed in:
  * The "context" field from the app (JSON or text snapshot of the current screen).
  * The arguments and results of tools you call.
- If exact numbers aren't available, give qualitative guidance and clearly say what additional info you would need for precise math.
- Never invent specific dollar amounts or dates that are not supported by context or tool outputs.

SAFETY RULES:
- Never delete data.
- Never move money between projects or accounts.
- Never approve a large change order without clear confirmation.
- If unclear or risky, ask one short clarifying question.

AI PROJECT MANAGER MODE:
If "ai_project_manager_mode" is true, you MUST act proactively, not just reactively:
- Always check the active project's estimate, costs, payments, schedule, and notes.
- Identify risks, missing costs, and schedule or cash flow issues.
- Suggest next actions the contractor should take.
- When the user opens the Assistant, start with a brief project health summary, not just "How can I help?".

Your priorities in Project Manager Mode:
1. Protect profit margin (monitor actual vs estimated costs, flag margin drops below thresholds like 25%).
2. Keep schedule on track (watch milestones, payments, suggest tweaks when behind).
3. Avoid surprises (scan for missing costs, risky items like no permits, unclear scope).
4. Generate proactive suggestions:
   - "I recommend adding a 5–8% contingency to this bid."
   - "You're 40% complete but only billed 25%. Want to add a progress invoice?"
   - "Material prices went up 6%. Should I update the estimate and payment schedule?"
- Produce recurring "manager" outputs: daily job log drafts, weekly client updates, weekly project health summaries (green/yellow/red status).

If you follow these rules, you will behave like a senior project manager AI that understands construction, protects profit, and uses the tools reliably.
`;

// ----- Helper function to build system prompt with AI PM mode -----
function buildSystemPrompt(aiProjectManagerMode?: boolean): string {
  if (!aiProjectManagerMode) {
    return MASTER_SYSTEM_PROMPT;
  }
  
  // Add AI PM mode indicator to the prompt
  return MASTER_SYSTEM_PROMPT + `\n\n[AI PROJECT MANAGER MODE: ENABLED]`;
}

type ActionIntent = {
  isAction: boolean;
  type: 'add_material' | 'add_labor' | 'change_order' | 'payment' | 'estimate' | 'other';
  isExpense: boolean;
};

function parseContextStatus(context?: string): string {
  if (!context) return '';
  try {
    const parsed = JSON.parse(context);
    return (parsed.status || parsed.projectStatus || '').toString().toLowerCase();
  } catch {
    return '';
  }
}

function detectActionIntent(message: string): ActionIntent {
  const lower = message.toLowerCase();
  // More comprehensive action detection - includes "can you", "will you", "please", etc.
  const actionVerbs = /(add|record|log|create|update|set|change|modify|approve|pay|paid|spent|bought|purchase|do it|do this|handle|take care of|apply|can you|will you|please add|please create)/;
  const isAction = actionVerbs.test(lower);
  
  // CRITICAL: Check for expense keywords FIRST - "spent", "bought", "purchase", "materials spent in projects"
  // These indicate recording an expense for a PROJECT, not adding to an estimate
  const isExpense = /(spent|bought|purchase|paid|receipt|materials spent|material spent)/.test(lower);
  
  // Check if user mentions a specific project name (not "this project" or "current project")
  // If they mention a project name AND say "spent" or "materials spent", it's definitely a project expense
  const mentionsSpecificProject = /(for|to|in)\s+([A-Z][a-z]+|[a-z]+\s+[a-z]+)\s+(project|job)/.test(lower) ||
    /([A-Z][a-z]+|[a-z]+\s+[a-z]+)\s+(project|job)/.test(lower);

  // Check for material-related keywords
  if (/material/.test(lower) || /material cost/.test(lower) || /material spent/.test(lower)) {
    // If user says "materials spent in projects" or mentions a specific project, it's an expense
    if (isExpense || mentionsSpecificProject || lower.includes('materials spent')) {
      return { isAction: true, type: 'add_material', isExpense: true };
    }
    return { isAction: true, type: 'add_material', isExpense };
  }
  // Check for labor-related keywords
  if (/labor|labour|subcontractor|sub labor|crew/.test(lower)) {
    return { isAction: true, type: 'add_labor', isExpense };
  }
  // Check for change order
  if (/change order/.test(lower)) {
    return { isAction: true, type: 'change_order', isExpense: false };
  }
  // Check for payment
  if (/payment|invoice|deposit|milestone|weekly/.test(lower)) {
    return { isAction: true, type: 'payment', isExpense: false };
  }
  // Check for estimate/bid
  if (/estimate|bid/.test(lower) && isAction) {
    return { isAction: true, type: 'estimate', isExpense: false };
  }
  // If action verb detected but no specific type, still mark as action
  if (isAction) {
    return { isAction: true, type: 'other', isExpense };
  }
  return { isAction: false, type: 'other', isExpense: false };
}

function buildActionClarification(intent: ActionIntent, status: string): string {
  const isEstimateProject = ['estimate', 'draft', 'submitted', 'bid_submitted'].includes(status);

  if (intent.type === 'add_material') {
    if (intent.isExpense || !isEstimateProject) {
      return 'What material, amount, and vendor did you spend? (Example: "Lumber $500 at Home Depot")';
    }
    return 'What material and amount should I add to the estimate? (Example: "Lumber $500")';
  }

  if (intent.type === 'add_labor') {
    return 'What labor type and amount should I add? (Example: "Electrical labor $1,200")';
  }

  if (intent.type === 'change_order') {
    return 'What’s the change order description and total amount? If you can, include material and labor breakdown.';
  }

  if (intent.type === 'payment') {
    return 'What payment amount/percentage and due date should I add?';
  }

  if (intent.type === 'estimate') {
    return 'What should I add or change in the estimate (material/labor name and amount)?';
  }

  return 'Tell me the details (what to add and the amount), and I’ll take care of it.';
}

// ----- Main AI endpoint -----
app.post("/api/ai-assistant", async (req, res) => {
  const { message, context, history, user_settings } = req.body as {
    message: string;
    context?: string;
    history?: { role: "user" | "assistant"; content: string }[];
    user_settings?: {
      ai_project_manager_mode?: boolean;
    };
  };

  const aiProjectManagerMode = user_settings?.ai_project_manager_mode ?? false;
  const systemPrompt = buildSystemPrompt(aiProjectManagerMode);
  const actionIntent = detectActionIntent(message);
  const contextStatus = parseContextStatus(context);
  
  // CRITICAL: Check ALL messages in history for project names, not just current message
  // This ensures we detect project names from previous messages in the conversation
  const allMessages = [...(history || []), { role: 'user' as const, content: message }];
  const allMessageText = allMessages.map(m => m.content).join(' ');
  const domain = resolveAssistantDomain(context, allMessageText);
  const domainTools = selectToolsForDomain(domain);
  const actionEnforcement = actionIntent.isAction
    ? `CRITICAL: The user issued a COMMAND. You MUST either (1) call the correct tool to perform the action, or (2) ask ONE clarifying question to get missing details. 
NEVER say you "can't make changes" or "can't do that." 
If AI Project Manager Mode is enabled, DO NOT prepend a health summary for command requests. Execute the command instead.`
    : '';

  try {
    // 1) First call: let OpenAI decide whether to answer or use a tool
    const first = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            systemPrompt +
            `\n\n[ROUTING]\n- assistantDomain=${domain}\n- Use ONLY the tools provided. If a tool you want is missing, ask a single clarifying question instead.` +
            (actionEnforcement ? `\n\n${actionEnforcement}` : ''),
        },
        ...(context
          ? [
              {
                role: "system" as const,
                content: `Screen context from the app: ${context}`,
              },
            ]
          : []),
        ...(history ?? []),
        { role: "user", content: message },
      ],
      tools: domainTools,
      tool_choice: "auto",
      temperature: 0.4,
    });

    const choice = first.choices[0];

    // No tool calls → check if this is an action request that requires a tool
    if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
      // CRITICAL: If user asked for an action but AI didn't call a tool, check if we need to ask for project first
      if (actionIntent.isAction) {
        console.log('🚨 Action detected but no tool called');
        console.log('Action intent:', actionIntent);
        console.log('Context status:', contextStatus);
        
        // Check if we're in general context (AI Assistant page) and no project is mentioned
        let parsedContext: any = {};
        try {
          parsedContext = context ? JSON.parse(context) : {};
        } catch (e) {
          console.error('Error parsing context:', e);
        }
        
        const isGeneralContext = !parsedContext.projectId && 
                                 !parsedContext.activeProjectId && 
                                 (parsedContext.screen === 'AI Assistant Tab' || 
                                  parsedContext.screen === 'AI Assistant' ||
                                  !parsedContext.screen);
        
        // Check if project name is mentioned in message or history
        const allText = allMessageText.toLowerCase();
        let hasProjectName = false;
        
        if (parsedContext.allProjects && Array.isArray(parsedContext.allProjects)) {
          hasProjectName = parsedContext.allProjects.some((p: any) => {
            const title = (p.title || '').toLowerCase();
            const customer = (p.customerName || '').toLowerCase();
            return allText.includes(title) || 
                   allText.includes(customer) ||
                   new RegExp(`(?:for|to|in|is)\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(?:project|job)`, 'i').test(allText) ||
                   new RegExp(`(?:for|to|in|is)\\s+${customer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(?:project|job)`, 'i').test(allText);
          });
        }
        
        // If in general context and no project mentioned, ask for project FIRST
        if (isGeneralContext && !hasProjectName && (actionIntent.type === 'add_material' || actionIntent.type === 'add_labor')) {
          console.log('📋 No project mentioned in general context - asking for project first');
          return res.json({
            reply: 'Which project is this for?',
          });
        }
        
        // Force a tool call with explicit requirement
        const forcedCall = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: systemPrompt + `
CRITICAL: The user asked you to perform an action: "${message}"
You MUST use a tool to perform this action. Do NOT give instructions.

ACTION DETECTED: ${actionIntent.type}
ASSISTANT DOMAIN: ${domain}
CONTEXT: ${context ? JSON.stringify(JSON.parse(context), null, 2) : 'No context'}

REQUIRED BEHAVIOR:
- BEFORE calling any tool, you MUST check the project's status in context.allProjects:
  * Find the project by name in context.allProjects
  * Check the status field: 'won'/'active'/'in_progress'/'completed' = ACTIVE PROJECT → use record_material_purchase
  * Check the status field: 'draft'/'estimate'/'submitted'/'bid_submitted' = ESTIMATE → use update_estimate_item
  * If project not found or status unclear, ask the user
- If user says "add material", "add material cost", "add 500 material spent", "add it to my project budget":
  * For ACTIVE PROJECTS → use record_material_purchase (expense)
  * For ESTIMATES → use update_estimate_item (line item)
- If user says "add labor":
  * For ACTIVE PROJECTS → use record_labor_expense (expense)
  * For ESTIMATES → use update_estimate_item (line item)
- If you're missing information (like material name), ask ONE question, then use the tool.
- NEVER say "I'm unable" or "you can easily" - you have tools, use them!
- NEVER assume a project is an estimate - always check the status field first!

${actionEnforcement}
`,
            },
            ...(context
              ? [
                  {
                    role: "system" as const,
                    content: `Screen context from the app: ${context}`,
                  },
                ]
              : []),
            ...(history ?? []),
            { role: "user", content: message },
          ],
          tools: domainTools,
          tool_choice: "required", // FORCE tool usage
          temperature: 0.2, // Lower temperature for more deterministic behavior
        });
        
        const forcedChoice = forcedCall.choices[0];
        if (forcedChoice.message.tool_calls && forcedChoice.message.tool_calls.length > 0) {
          // Use the forced tool calls instead
          choice.message = forcedChoice.message;
          console.log('✅ Forced tool call successful:', forcedChoice.message.tool_calls.map(tc => tc.function?.name));
        } else {
          // Even with forced tool choice, if no tool was called, return clarification
          console.log('⚠️ Even forced tool_choice failed - returning clarification');
          return res.json({
            reply: buildActionClarification(actionIntent, contextStatus, message),
          });
        }
      } else {
        // Not an action request, just answer normally
        return res.json({
          reply: choice.message.content ?? "I'm not sure how to answer that.",
        });
      }
    }

    // There ARE tool calls → handle them
    const toolCalls = choice.message.tool_calls;
    const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [];
    const actions: any[] = []; // Store actions for response

    for (const toolCall of toolCalls) {
      try {
        const { name, arguments: argsJson } = toolCall.function;
        const args = JSON.parse(argsJson || "{}");

        if (name === "create_new_bid") {
        const result = await ProjectService.createNewBid({
          ...args,
          context: context,
        });

        actions.push({
          type: "create_new_bid",
          bidId: result.bidId,
          title: result.title,
          customerName: result.customerName,
          location: result.location,
          projectType: result.projectType,
          sqft: result.sqft,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result),
        });
      } else if (name === "record_material_purchase") {
        try {
          const result = await ProjectService.recordMaterialPurchase({
            ...args,
            context: context,
          });

          // Check if result indicates this was an estimate (should have used update_estimate_item)
          if (result.error === "INVALID_STATUS") {
            toolMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name,
              content: JSON.stringify({
                error: "INVALID_STATUS",
                message: `The project "${result.projectName || args.project_name}" is an ESTIMATE (status: ${result.status || 'estimate'}). Use update_estimate_item tool instead of record_material_purchase for estimates.`,
                projectName: result.projectName || args.project_name,
                status: result.status,
              }),
            });
          } else {
            actions.push({
              type: "add_material",
              projectName: result.projectName,
              projectId: result.projectId,
              amount: args.amount,
              vendor: args.vendor,
              category: args.category,
              notes: result.notes,
            });

            toolMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name,
              content: JSON.stringify(result),
            });
          }
        } catch (error: any) {
          // Handle validation errors from recordMaterialPurchase
          if (error.message && error.message.includes('INVALID_STATUS')) {
            toolMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name,
              content: JSON.stringify({
                error: "INVALID_STATUS",
                message: error.message,
              }),
            });
          } else {
            throw error; // Re-throw if it's a different error
          }
        }
      } else if (name === "record_labor_expense") {
        const result = await ProjectService.recordLaborExpense({
          ...args,
          context: context,
        });

        actions.push({
          type: "add_labor_expense",
          projectName: result.projectName,
          projectId: result.projectId,
          amount: args.amount,
          laborType: result.laborType,
          hours: result.hours,
          rate: result.rate,
          vendor: result.vendor,
          notes: result.notes,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result),
        });
      } else if (name === "create_change_order") {
        // Check if materialsAmount and laborAmount are missing
        // If they are, we should ask the user for them instead of creating the change order
        const hasMaterialsAmount = args.materialsAmount !== undefined && args.materialsAmount !== null;
        const hasLaborAmount = args.laborAmount !== undefined && args.laborAmount !== null;
        
        if (!hasMaterialsAmount || !hasLaborAmount) {
          // Don't create the change order - instead, we'll have the AI ask for the breakdown
          // We'll return a special response that tells the AI to ask for materials and labor
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              error: "MISSING_BREAKDOWN",
              message: `To create this change order for $${args.amount}, I need the breakdown of materials and labor costs. Please ask the user: "I'd like to create a change order for $${args.amount} for ${args.title || 'this project'}. Can you please confirm the breakdown: How much is for materials and how much is for labor?"`,
              projectName: args.project_name,
              title: args.title,
              amount: args.amount,
            }),
          });
        } else {
          // Both materials and labor amounts are provided - proceed with creating the change order
          const result = await ProjectService.createChangeOrder({
            ...args,
            context: context,
          });

          // Check for invalid status error (draft/estimate project)
          if (result.error === "INVALID_STATUS") {
            toolMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name,
              content: JSON.stringify({
                error: "INVALID_STATUS",
                message: result.message,
                suggestion: "Use 'update_estimate_item' instead to add materials or labor to the estimate.",
              }),
            });
          } else {
            actions.push({
              type: "add_change_order",
              projectName: result.projectName,
              projectId: result.projectId,
              title: result.title,
              amount: args.amount,
              approved: result.approved,
              notes: result.notes,
              materialsAmount: args.materialsAmount,
              laborAmount: args.laborAmount,
            });

            toolMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name,
              content: JSON.stringify(result),
            });
          }
        }
      } else if (name === "create_purchase_order") {
        const result = await ProjectService.createPurchaseOrder({
          ...args,
          context: context,
        });

        actions.push({
          type: "add_purchase_order",
          projectName: result.projectName,
          projectId: result.projectId,
          poNumber: result.poNumber,
          vendor: result.vendor,
          category: result.category,
          amount: args.amount,
          description: result.description,
          expectedDelivery: result.expectedDelivery,
          notes: result.notes,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result),
        });
      } else if (name === "approve_change_order") {
        const result = await ProjectService.approveChangeOrder({
          ...args,
          context: context,
        });

        actions.push({
          type: "approve_change_order",
          projectName: result.projectName,
          projectId: result.projectId,
          changeOrderTitle: result.changeOrderTitle,
          changeOrderId: result.changeOrderId,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result),
        });
      } else if (name === "update_timeline_milestone") {
        const result = await ProjectService.updateTimelineMilestone({
          ...args,
          context: context,
        });

        actions.push({
          type: "update_timeline_milestone",
          projectName: result.projectName,
          projectId: result.projectId,
          milestoneName: result.milestoneName,
          newStatus: result.newStatus,
          progressPct: result.progressPct,
          plannedDate: result.plannedDate,
          notes: result.notes,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } else if (name === "suggest_missing_costs") {
        const result = await ProjectService.suggestMissingCosts({
          ...args,
          context: context,
        });

        actions.push({
          type: "suggest_missing_costs",
          projectName: result.projectName,
          projectId: result.projectId,
          projectData: result.projectData,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } else if (name === "search_material_prices") {
        const result = await ProjectService.searchMaterialPrices({
          ...args,
          context: context,
        });

        actions.push({
          type: "search_material_prices",
          material: result.material,
          zip: result.zip,
          stores: result.stores,
          comparison: result.comparison,
          error: result.error,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } else if (name === "search_contractors") {
        const result = await ProjectService.searchContractors({
          ...args,
          context: context,
        });

        actions.push({
          type: "search_contractors",
          trade: result.trade,
          location: result.location,
          contractors: result.contractors,
          total: result.total,
          error: result.error,
          isMockData: result.isMockData,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } else if (name === "get_recent_projects") {
        const result = await ProjectService.getRecentProjects({
          ...args,
          context: context,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result),
        });
      } else if (name === "get_project_snapshot") {
        const result = await ProjectService.getProjectSnapshot({
          ...args,
          context: context,
        });

        if (result.error) {
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name,
            content: JSON.stringify({
              error: result.error,
              projectId: result.projectId,
              projectData: null,
            }),
          });
        } else {
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name,
            content: JSON.stringify(result),
          });
        }
      } else if (name === "summarize_project") {
        const result = await ProjectService.summarizeProject({
          ...args,
          context: context,
        });

        // If there's an error (project not found), return error message to AI
        if (result.error) {
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name,
            content: JSON.stringify({
              error: result.error,
              projectName: result.projectName,
              projectId: null,
              projectData: null,
            }),
          });
        } else {
          actions.push({
            type: "summarize_project",
            projectName: result.projectName,
            projectId: result.projectId,
            projectData: result.projectData,
          });

          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name,
            content: JSON.stringify(result),
          });
        }
      } else if (name === "calculate_project_profitability") {
        const result = await ProjectService.calculateProjectProfitability({
          ...args,
          context: context,
        });

        actions.push({
          type: "calculate_project_profitability",
          projectName: result.projectName,
          projectId: result.projectId,
          projectData: result.projectData,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } else if (name === "identify_project_risks") {
        const result = await ProjectService.identifyProjectRisks({
          ...args,
          context: context,
        });

        actions.push({
          type: "identify_project_risks",
          projectName: result.projectName,
          projectId: result.projectId,
          projectData: result.projectData,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } else if (name === "add_project_note") {
        const result = await ProjectService.addProjectNote({
          ...args,
          context: context,
        });

        actions.push({
          type: "add_project_note",
          projectName: result.projectName,
          projectId: result.projectId,
          note: result.note,
          noteType: result.noteType,
          timestamp: result.timestamp,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result),
        });
      } else if (name === "update_project_details") {
        const result = await ProjectService.updateProjectDetails({
          ...args,
          context: context,
        });

        actions.push({
          type: "update_project_details",
          projectName: result.projectName,
          projectId: result.projectId,
          budgetRange: result.budgetRange,
          scopeDescription: result.scopeDescription,
          startDate: result.startDate,
          endDate: result.endDate,
          projectData: result.projectData,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result),
        });
      } else if (name === "update_overhead_markup") {
        const result = await ProjectService.updateOverheadMarkup({
          ...args,
          context: context,
        });

        actions.push({
          type: "update_overhead_markup",
          projectName: result.projectName,
          projectId: result.projectId,
          insuranceOverhead: result.insuranceOverhead,
          equipment: result.equipment,
          facilities: result.facilities,
          otherOverhead: result.otherOverhead,
          markupPct: result.markupPct,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result),
        });
      } else if (name === "add_payment_milestone") {
        const result = await ProjectService.addPaymentMilestone({
          ...args,
          context: context,
        });

        if (result.error) {
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name,
            content: JSON.stringify(result),
          });
        } else {
          actions.push({
            type: "add_payment_milestone",
            projectName: result.projectName,
            projectId: result.projectId,
            milestone: result.milestone,
          });

          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name,
            content: JSON.stringify(result),
          });
        }
      } else if (name === "add_weekly_payment") {
        const result = await ProjectService.addWeeklyPayment({
          ...args,
          context: context,
        });

        if (result.error) {
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name,
            content: JSON.stringify(result),
          });
        } else {
          actions.push({
            type: "add_weekly_payment",
            projectName: result.projectName,
            projectId: result.projectId,
            payment: result.payment,
          });

          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name,
            content: JSON.stringify(result),
          });
        }
      } else if (name === "set_payment_schedule_type") {
        const result = await ProjectService.setPaymentScheduleType({
          ...args,
          context: context,
        });

        actions.push({
          type: "set_payment_schedule_type",
          projectName: result.projectName,
          projectId: result.projectId,
          paymentSchedule: result.paymentSchedule,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result),
        });
      } else if (name === "set_work_schedule") {
        const result = await ProjectService.setWorkSchedule({
          ...args,
          context: context,
        });

        actions.push({
          type: "set_work_schedule",
          projectName: result.projectName,
          projectId: result.projectId,
          workSchedule: result.workSchedule,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result),
        });
      } else if (name === "set_project_timeline") {
        const result = await ProjectService.setProjectTimeline({
          ...args,
          context: context,
        });

        actions.push({
          type: "set_project_timeline",
          projectName: result.projectName,
          projectId: result.projectId,
          startDate: result.startDate,
          durationDays: result.durationDays,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result),
        });
      } else if (name === "share_contract") {
        const result = await ProjectService.shareContract({
          ...args,
          context: context,
        });

        if (result.error) {
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } else {
          actions.push({
            type: "share_contract",
            projectName: result.projectName,
            projectId: result.projectId,
            shareMethod: result.shareMethod,
            email: result.email,
            phoneNumber: result.phoneNumber,
          });

          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      } else if (name === "show_contract") {
        const result = await ProjectService.showContract({
          ...args,
          context: context,
        });

        if (result.error) {
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } else {
          actions.push({
            type: "show_contract",
            projectName: result.projectName,
            projectId: result.projectId,
          });

          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      } else if (name === "update_customer_info") {
        const result = await ProjectService.updateCustomerInfo({
          ...args,
          context: context,
        });

        actions.push({
          type: "update_customer_info",
          projectName: result.projectName,
          projectId: result.projectId,
          customerName: result.customerName,
          email: result.email,
          phone: result.phone,
          company: result.company,
          address: result.address,
          city: result.city,
          state: result.state,
          zip: result.zip,
          notes: result.notes,
          projectData: result.projectData,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify(result),
        });
      } else if (name === "update_estimate_item") {
        const result = await ProjectService.updateEstimateItem({
          ...args,
          context: context,
        });

        // Check if the original message mentioned "labor" to help frontend prioritize
        const originalMessage = message.toLowerCase();
        const isLaborUpdate = originalMessage.includes('labor') && 
                              (originalMessage.includes('update') || originalMessage.includes('change') || originalMessage.includes('set'));
        
        actions.push({
          type: "update_estimate_item",
          projectName: result.projectName,
          projectId: result.projectId,
          itemDescription: result.itemDescription,
          itemId: result.itemId,
          newAmount: result.newAmount,
          newQuantity: result.newQuantity,
          newUnitCost: result.newUnitCost,
          newDescription: result.newDescription,
          projectScope: result.projectScope, // Pass through the project scope parameter
          projectData: result.projectData,
          isLaborUpdate: isLaborUpdate, // Pass flag to help frontend prioritize labor
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } else if (name === "log_daily_progress") {
        const result = await ProjectService.logDailyProgress({
          ...args,
          context: context,
        });
        actions.push({ type: "log_daily_progress", ...result });
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } else if (name === "forecast_total_cost") {
        const result = await ProjectService.forecastTotalCost({
          ...args,
          context: context,
        });
        if (result.error) {
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } else {
          actions.push({ type: "forecast_total_cost", ...result });
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      } else if (name === "find_alternative_materials") {
        const result = await ProjectService.findAlternativeMaterials({
          ...args,
          context: context,
        });
        actions.push({ type: "find_alternative_materials", ...result });
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } else if (name === "generate_project_proposal") {
        const result = await ProjectService.generateProjectProposal({
          ...args,
          context: context,
        });
        if (result.error) {
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } else {
          actions.push({ type: "generate_project_proposal", ...result });
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      } else if (name === "export_estimate_pdf") {
        const result = await ProjectService.exportEstimatePdf({
          ...args,
          context: context,
        });
        if (result.error) {
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } else {
          actions.push({ type: "export_estimate_pdf", ...result });
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      } else if (name === "safety_checklist") {
        const result = await ProjectService.safetyChecklist({
          ...args,
          context: context,
        });
        actions.push({ type: "safety_checklist", ...result });
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } else if (name === "recommend_next_steps") {
        const result = await ProjectService.recommendNextSteps({
          ...args,
          context: context,
        });
        if (result.error) {
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } else {
          actions.push({ type: "recommend_next_steps", ...result });
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      } else if (name === "generate_client_update") {
        const result = await ProjectService.generateClientUpdate({
          ...args,
          context: context,
        });
        if (result.error) {
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } else {
          actions.push({ type: "generate_client_update", ...result });
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      } else if (name === "translate_update") {
        const result = await ProjectService.translateUpdate(args);
        actions.push({ type: "translate_update", ...result });
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } else if (name === "profitability_forecast_pro") {
        const result = await ProjectService.profitabilityForecastPro({
          ...args,
          context: context,
        });
        if (result.error) {
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } else {
          actions.push({ type: "profitability_forecast_pro", ...result });
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      } else if (name === "ai_project_manager_mode") {
        const result = await ProjectService.aiProjectManagerMode({
          ...args,
          context: context,
        });
        actions.push({ type: "ai_project_manager_mode", ...result });
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } else {
        // Unknown tool name - send error response to prevent API error
        console.error(`Unknown tool name: ${name}`);
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            error: "UNKNOWN_TOOL",
            message: `Unknown tool: ${name}`,
          }),
        });
      }
      } catch (error) {
        // If any tool call fails, we MUST still send a tool message
        console.error(`Error processing tool call ${toolCall.id} (${toolCall.function?.name || 'unknown'}):`, error);
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            error: "TOOL_EXECUTION_ERROR",
            message: error instanceof Error ? error.message : String(error),
          }),
        });
      }
    }

    // 2) Second call: ask OpenAI to explain what happened in human language
    // Detect if this is a project_analysis intent (NOT an action request)
    const lowerMessageForAnalysis = message.toLowerCase();
    const isActionRequestForAnalysis = 
      lowerMessageForAnalysis.includes('add') ||
      lowerMessageForAnalysis.includes('create') ||
      lowerMessageForAnalysis.includes('update') ||
      lowerMessageForAnalysis.includes('record') ||
      lowerMessageForAnalysis.includes('set') ||
      lowerMessageForAnalysis.includes('change') ||
      lowerMessageForAnalysis.includes('modify') ||
      lowerMessageForAnalysis.includes('remove') ||
      lowerMessageForAnalysis.includes('delete');
    
    const isProjectAnalysis = !isActionRequestForAnalysis && (
      lowerMessageForAnalysis.includes('analyze') ||
      lowerMessageForAnalysis.includes('analysis') ||
      lowerMessageForAnalysis.includes('project health') ||
      lowerMessageForAnalysis.includes('how is this job') ||
      lowerMessageForAnalysis.includes('how\'s this project') ||
      (context && JSON.parse(context).resolvedProjectId && 
       (lowerMessageForAnalysis.includes('status') || lowerMessageForAnalysis.includes('health')))
    );
    
    // Detect if user is asking about "my project" / "this job" / "our estimate" without context
    let parsedContext: any = {};
    try {
      parsedContext = context ? JSON.parse(context) : {};
    } catch (e) {
      // Context parsing failed
    }
    
    const isProjectQueryWithoutContext = 
      (message.toLowerCase().includes('my project') ||
       message.toLowerCase().includes('this job') ||
       message.toLowerCase().includes('our estimate') ||
       message.toLowerCase().includes('our project') ||
       message.toLowerCase().includes('my job')) &&
      !parsedContext.resolvedProjectId;
    
    // Build enforcement prompt for project analysis
    const projectAnalysisEnforcement = isProjectAnalysis && !isActionRequestForAnalysis ? `
CRITICAL: This is a PROJECT ANALYSIS request (NOT an action request like "add", "create", "update"). You MUST follow the strict Project Analysis Template:
1) Start with: "Here's the current analysis for [Project Name]..."
2) Provide SUMMARY (2-3 bullets): budget status, margin status, schedule status
3) BUDGET & COSTING: Planned vs Actual, Top 3 cost drivers, Missing costs, Suspicious entries
4) PROFITABILITY: Current margin vs target, Forecast at completion, Risk level (Low/Med/High) + why
5) SCHEDULE: Milestones at risk, Next 7-day critical path actions
6) RISKS & RECOMMENDATIONS: 3 prioritized actions to protect margin
7) NEXT BEST ACTIONS: List as buttons (Add missing cost, Update schedule, Generate change order, Send client update)

If any section lacks data, say "Data needed" + propose exact next step/tool call.
Use numbers ONLY from project snapshot (no guessing).
Format as structured JSON when possible for better parsing.
` : '';

    // Build prompt for missing project context
    const missingContextEnforcement = isProjectQueryWithoutContext ? `
CRITICAL: User asked about "my project" / "this job" / "our estimate" but project context is missing.
DO NOT say "I don't have access" or "I lack access to project data".
INSTEAD:
1) Use get_recent_projects() tool to see available projects
2) If only one project exists, use get_project_snapshot(project_id) with that project's ID
3) If multiple projects exist, ask a SINGLE clarifying question: "Which project do you mean?" and list the top 3 most recent/active projects with their status
4) Once project is identified, ALWAYS use get_project_snapshot(project_id) to fetch full data before answering
5) Never proceed with answering until you have fetched the project snapshot
` : '';

    const second = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt + `
You are finalizing a response for a contractor inside the Build Profit Solutions app.
Explain clearly what changed, what it means, and what they should know.

CRITICAL RULES FOR ACTION RESPONSES:
- If a tool was called to perform an action (add, create, update, record), you MUST confirm what was done, NOT give instructions.
- NEVER say "I can't", "I'm unable", "you can easily", "go to", "navigate to", "select", "look for", or any instruction phrase.
- ALWAYS start with: "Got it! I've added..." or "Done! I've recorded..." - be confident and direct.
- Mention the specific details: amount, material/labor type, project name, and where it will appear.

EXAMPLES OF CORRECT RESPONSES:
✅ "Got it! I've added $500 for materials to your current estimate. This will appear in the materials section."
✅ "Done! I've recorded $500 for lumber from Home Depot to Bob project. This will show up in your expenses."
✅ "I've added $500 for materials to the estimate. The total has been updated."

EXAMPLES OF FORBIDDEN RESPONSES:
❌ "I can't directly make changes, but you can easily add..."
❌ "To add $500, go to the budget section..."
❌ "Navigate to the expenses section and select Add Expense..."
❌ "You would typically go to..."

Rules:
- Be concise (2–5 short paragraphs or bullet points).
- If a tool performed an update, confirm it in a conversational, confident tone:
  * Single item: "Got it! I've recorded $500 for lumber from Home Depot to Bob project. This will show up in your expenses."
  * Multiple items: "Got it! I've recorded $500 for lumber and $300 for tile from Home Depot to Bob project. Both will show up in your expenses."
  * Include the project name naturally, mention where it will appear (expenses, budget, etc.)
- Mention key numbers (amounts, dates, statuses) ONLY if they appear in tool outputs.
- If no tool was used (analysis only), provide a strong, actionable summary.
- Never mention tools, JSON, or internal processes.
- Speak like a construction project manager - friendly, professional, and helpful.
- When confirming an action, be direct and confident with a conversational tone. Don't hedge with "Let me know if you need anything else" - just confirm what you did clearly.
- ERROR RECOVERY: If a tool call fails, explain what went wrong in plain language and suggest a fix:
  * "I couldn't record that expense because [specific reason from error]. Try [specific fix]."
  * "The project wasn't found. Did you mean [suggested project name]?"
  * "I need the material type to record this. What material was this for?"
  * Never say "An error occurred" - be specific about what failed and how to fix it.
- CRITICAL: If a tool returns error "INVALID_STATUS" (e.g., record_material_purchase called for an estimate):
  * The tool will tell you the project status and suggest the correct tool
  * IMMEDIATELY use the suggested tool (e.g., update_estimate_item) instead
  * Do NOT ask the user - just fix it and use the correct tool
  * Example: If record_material_purchase returns INVALID_STATUS saying "use update_estimate_item", immediately call update_estimate_item with the same parameters
- IMPORTANT: When showing budget numbers, use the numbers from the tool result for the SPECIFIC project mentioned by the user.
- Do NOT use numbers from the current bid or any other project.
- CRITICAL: If you don't have real project data from a tool call, DO NOT invent numbers. Say "I need to fetch the project data first" and call get_project_snapshot() before answering.
- NEVER show project health, budget, or margin data unless you've successfully called get_project_snapshot() and received real data.
- NEVER show "$50,000", "$500,000", or any placeholder budget amounts - these are FORBIDDEN.
- If get_project_snapshot() fails or returns null, tell the user: "I couldn't load the project data right now. The project might not exist or there might be a connection issue. Please try again."
- If you're about to show a "Project Health Summary" or any analysis, you MUST have called get_project_snapshot() first and received valid data. If not, don't show the summary.
- CRITICAL: If a tool returns an error with 'MISSING_BREAKDOWN', you MUST ask the user for the materials and labor breakdown before creating the change order.
- Use the message from the tool error to guide your response.
- When creating a change order that is not approved, always end your message with: 'The change order is currently pending approval. Please let me know if you want to approve it.'
- CRITICAL: When adding materials to a DRAFT/ESTIMATE project (status: 'estimate', 'draft', 'submitted'), NEVER mention "change order" in your response. Simply confirm that you've added the material to the estimate (e.g., "I've added $X for [material] to the estimate"). Change orders are only relevant for active/won projects.
${projectAnalysisEnforcement}
${missingContextEnforcement}
`,
        },
        ...(history ?? []),
        { role: "user", content: message },
        choice.message, // selected tool call(s)
        ...toolMessages, // results of executed tools
      ],
      temperature: 0.4,
    });

    // Check if any tool returned INVALID_STATUS error (wrong tool for project type)
    // If so, automatically retry with the correct tool
    const hasInvalidStatusError = toolMessages.some((msg: any) => {
      try {
        const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
        return content?.error === 'INVALID_STATUS' && content?.message?.includes('update_estimate_item');
      } catch {
        return false;
      }
    });
    
    if (hasInvalidStatusError) {
      console.log('🔄 INVALID_STATUS detected - retrying with correct tool (update_estimate_item)');
      
      // Find the INVALID_STATUS error to get the project details
      let invalidStatusMsg: any = null;
      for (const msg of toolMessages) {
        try {
          const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
          if (content?.error === 'INVALID_STATUS' && content?.message?.includes('update_estimate_item')) {
            invalidStatusMsg = content;
            break;
          }
        } catch {}
      }
      
      // Find the original tool call that failed
      const failedToolCall = choice.message.tool_calls?.find((tc: any) => tc.function?.name === 'record_material_purchase');
      if (failedToolCall && invalidStatusMsg) {
        const originalArgs = JSON.parse(failedToolCall.function.arguments || '{}');
        
        // Automatically call update_estimate_item with the same parameters
        try {
          const estimateResult = await ProjectService.updateEstimateItem({
            project_name: originalArgs.project_name || invalidStatusMsg.projectName,
            item_type: 'material',
            item_description: originalArgs.category || 'Material',
            new_amount: originalArgs.amount,
            new_quantity: 1,
            new_unit_cost: originalArgs.amount,
            context: context,
          });
          
          // Replace the error message with success
          const successIndex = toolMessages.findIndex((msg: any) => {
            try {
              const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
              return content?.error === 'INVALID_STATUS';
            } catch {
              return false;
            }
          });
          
          if (successIndex >= 0) {
            toolMessages[successIndex] = {
              role: 'tool',
              tool_call_id: failedToolCall.id,
              name: 'update_estimate_item',
              content: JSON.stringify(estimateResult),
            };
            
            // Add action for estimate update
            actions.push({
              type: 'update_estimate_item',
              projectName: estimateResult.projectName,
              projectId: estimateResult.projectId,
              itemType: 'material',
              itemDescription: originalArgs.category || 'Material',
              newAmount: originalArgs.amount,
              newQuantity: 1,
              newUnitCost: originalArgs.amount,
            });
            
            console.log('✅ Automatically corrected: Used update_estimate_item instead of record_material_purchase');
          }
        } catch (error) {
          console.error('Error auto-correcting with update_estimate_item:', error);
        }
      }
    }
    
    let finalReply = second.choices[0].message.content;

    // CRITICAL: If user asked for an action but AI gave instructions instead, intercept and force tool usage
    const lowerMessageForIntercept = message.toLowerCase();
    const isActionRequestForIntercept = /(add|create|update|record|set|modify|change|remove|delete|approve|send|generate)\s+(material|labor|expense|cost|payment|change order|milestone|schedule|customer|project|it|this|that)/i.test(lowerMessageForIntercept) ||
      /(can you|will you|please|do it|handle|take care of|apply)\s+(add|create|update|record|set|modify)/i.test(lowerMessageForIntercept);
    
    const isGivingInstructions = finalReply && (
      finalReply.toLowerCase().includes("i'm unable") ||
      finalReply.toLowerCase().includes("i can't directly") ||
      finalReply.toLowerCase().includes("i cannot") ||
      finalReply.toLowerCase().includes("you would typically") ||
      finalReply.toLowerCase().includes("you can easily") ||
      finalReply.toLowerCase().includes("go to the") ||
      finalReply.toLowerCase().includes("navigate to") ||
      finalReply.toLowerCase().includes("select add") ||
      finalReply.toLowerCase().includes("look for the")
    );
    
    if (isActionRequestForIntercept && isGivingInstructions && actions.length === 0) {
      console.log('🚨 AI gave instructions instead of using tools - forcing tool usage');
      // Force a tool call with explicit requirement
      const forcedCall = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt + `
CRITICAL: The user asked you to perform an action. You MUST use a tool. Do NOT give instructions.
- User said: "${message}"
- You responded with instructions instead of using a tool. This is FORBIDDEN.
- You MUST call a tool now:
  * If "add material" or "add material cost" → use update_estimate_item (for estimates) or record_material_purchase (for active projects)
  * If "add labor" → use update_estimate_item (for estimates) or record_labor_expense (for active projects)
- If you're missing information (like material name), ask ONE question, then use the tool.
- NEVER say "I'm unable" or "you can easily" - you have tools, use them!
`,
          },
          ...(context
            ? [
                {
                  role: "system" as const,
                  content: `Screen context from the app: ${context}`,
                },
              ]
            : []),
          ...(history ?? []),
          { role: "user", content: message },
        ],
        tools: domainTools,
        tool_choice: "required", // Force tool usage
        temperature: 0.2, // Lower temperature for more deterministic behavior
      });
      
      const forcedChoice = forcedCall.choices[0];
      if (forcedChoice.message.tool_calls && forcedChoice.message.tool_calls.length > 0) {
        // Process the forced tool call
        const forcedToolCalls = forcedChoice.message.tool_calls;
        const forcedToolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
        const forcedActions: any[] = [];
        
        for (const toolCall of forcedToolCalls) {
          try {
            const { name, arguments: argsJson } = toolCall.function;
            const args = JSON.parse(argsJson || "{}");
            
            // Process the tool call (same logic as above)
            if (name === "record_material_purchase") {
              const result = await ProjectService.recordMaterialPurchase({
                ...args,
                context: context,
              });
              forcedActions.push({
                type: "add_material",
                projectName: result.projectName,
                projectId: result.projectId,
                amount: args.amount,
                vendor: args.vendor,
                category: args.category,
                notes: result.notes,
              });
              forcedToolMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name,
                content: JSON.stringify(result),
              });
            } else if (name === "update_estimate_item") {
              const result = await ProjectService.updateEstimateItem({
                ...args,
                context: context,
              });
              forcedActions.push({
                type: "update_estimate_item",
                projectName: result.projectName,
                projectId: result.projectId,
                itemDescription: result.itemDescription,
                newAmount: result.newAmount,
              });
              forcedToolMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name,
                content: JSON.stringify(result),
              });
            }
            // Add other tool handlers as needed
          } catch (error: any) {
            console.error(`Error processing forced tool call:`, error);
          }
        }
        
        // Generate final response with forced tool results
        const forcedFinal = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: systemPrompt + `
You are finalizing a response for a contractor inside the Build Profit Solutions app.
You just used a tool to perform an action the user requested.
Confirm what you did in a conversational, confident tone: "Got it! I've added..." or "Done! I've recorded..."
Do NOT give instructions - you already did it!
`,
            },
            ...(history ?? []),
            { role: "user", content: message },
            forcedChoice.message,
            ...forcedToolMessages,
          ],
          temperature: 0.4,
        });
        
        finalReply = forcedFinal.choices[0].message.content;
        // Merge forced actions with existing actions
        actions.push(...forcedActions);
      }
    }

    return res.json({
      reply: finalReply ?? "I processed your request.",
      action: actions.length > 0 ? actions[0] : undefined, // Return first action for backward compatibility
      actions: actions.length > 0 ? actions : undefined, // Also return all actions
    });
  } catch (err) {
    console.error("AI Assistant Error:", err);
    console.error("Error stack:", err instanceof Error ? err.stack : "No stack trace");
    return res.status(500).json({
      error: "AI_ERROR",
      message: "There was a problem processing your request.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`BPS AI Assistant API running on http://localhost:${port}`);
});

