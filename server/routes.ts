import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { insertJobSchema, insertAllocationSettingsSchema, insertLessonSchema, insertChildSchema } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Middleware to verify JWT token
function verifyToken(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, familyId: user.familyId },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.json({ token, user: { id: user.id, username: user.username, role: user.role, familyId: user.familyId, name: user.name } });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/me", verifyToken, async (req: any, res) => {
    try {
      const user = await storage.getUserByUsername(req.user.username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ id: user.id, username: user.username, role: user.role, familyId: user.familyId, name: user.name });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Children routes
  app.get("/api/children", verifyToken, async (req: any, res) => {
    try {
      const children = await storage.getChildrenByFamily(req.user.familyId);
      res.json(children);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/children/:id", verifyToken, async (req: any, res) => {
    try {
      const child = await storage.getChild(parseInt(req.params.id));
      if (!child || child.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Child not found" });
      }
      res.json(child);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/children", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can add children" });
      }

      const childData = insertChildSchema.parse({
        ...req.body,
        familyId: req.user.familyId,
      });

      const child = await storage.createChild(childData);

      // Create default user account for the child
      const username = child.name.toLowerCase().replace(/\s+/g, '');
      const defaultPassword = 'password123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      await storage.createUser({
        username,
        password: hashedPassword,
        role: "child",
        familyId: req.user.familyId,
        name: child.name,
      });

      // Create default allocation settings
      await storage.createAllocationSettings({
        childId: child.id,
        spendingPercentage: 25,
        savingsPercentage: 35,
        rothIraPercentage: 20,
        brokeragePercentage: 20,
      });

      res.status(201).json(child);
    } catch (error) {
      res.status(400).json({ message: "Invalid child data" });
    }
  });

  app.patch("/api/children/:id", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can update children" });
      }

      const childId = parseInt(req.params.id);
      const child = await storage.getChild(childId);
      
      if (!child || child.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Child not found" });
      }

      const updateData = {
        name: req.body.name,
        age: req.body.age,
      };

      const updatedChild = await storage.updateChild(childId, updateData);
      res.json(updatedChild);
    } catch (error) {
      res.status(400).json({ message: "Invalid child data" });
    }
  });

  app.delete("/api/children/:id", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can remove children" });
      }

      const childId = parseInt(req.params.id);
      const child = await storage.getChild(childId);
      
      if (!child || child.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Child not found" });
      }

      // Note: In a real app, you might want to archive instead of delete
      // This is a simplified implementation
      const success = await storage.deleteChild(childId);
      
      if (success) {
        res.json({ message: "Child removed successfully" });
      } else {
        res.status(500).json({ message: "Failed to remove child" });
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Jobs routes
  app.get("/api/jobs", verifyToken, async (req: any, res) => {
    try {
      let jobs;
      if (req.user.role === "parent") {
        jobs = await storage.getJobsByFamily(req.user.familyId);
      } else {
        // Find child ID for this user
        const children = await storage.getChildrenByFamily(req.user.familyId);
        const child = children.find(c => c.userId === req.user.id);
        if (!child) {
          return res.status(404).json({ message: "Child profile not found" });
        }
        jobs = await storage.getJobsByChild(child.id);
      }
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/jobs", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can create jobs" });
      }

      const jobData = insertJobSchema.parse({
        ...req.body,
        familyId: req.user.familyId,
        status: "assigned"
      });

      const job = await storage.createJob(jobData);
      res.json(job);
    } catch (error) {
      res.status(400).json({ message: "Invalid job data" });
    }
  });

  app.patch("/api/jobs/:id", verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job || job.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Job not found" });
      }

      const updatedJob = await storage.updateJob(jobId, req.body);
      
      // If job is approved, process payment
      if (req.body.status === "approved") {
        const amount = parseFloat(job.amount);
        let paymentAmounts;

        // Use custom allocation if provided, otherwise use default settings
        if (req.body.customAllocation) {
          paymentAmounts = {
            spendingAmount: req.body.customAllocation.spendingAmount.toFixed(2),
            savingsAmount: req.body.customAllocation.savingsAmount.toFixed(2),
            rothIraAmount: req.body.customAllocation.rothIraAmount.toFixed(2),
            brokerageAmount: req.body.customAllocation.brokerageAmount.toFixed(2),
          };
        } else {
          const allocation = await storage.getAllocationSettings(job.assignedToId);
          if (allocation) {
            paymentAmounts = {
              spendingAmount: (((allocation.spendingPercentage || 0) / 100) * amount).toFixed(2),
              savingsAmount: (((allocation.savingsPercentage || 0) / 100) * amount).toFixed(2),
              rothIraAmount: (((allocation.rothIraPercentage || 0) / 100) * amount).toFixed(2),
              brokerageAmount: (((allocation.brokeragePercentage || 0) / 100) * amount).toFixed(2),
            };
          }
        }

        if (paymentAmounts) {
          // Check if payment already exists for this job
          const existingPayments = await storage.getPaymentsByFamily(req.user.familyId);
          const existingPayment = existingPayments.find(p => p.jobId === job.id);
          
          if (!existingPayment) {
            // Create payment record only if it doesn't exist
            const payment = await storage.createPayment({
              jobId: job.id,
              childId: job.assignedToId,
              amount: job.amount,
              ...paymentAmounts,
            });
          }

          // Update child's balances, total earned, and completed jobs
          const child = await storage.getChild(job.assignedToId);
          if (child) {
            await storage.updateChild(job.assignedToId, {
              totalEarned: (parseFloat(child.totalEarned || "0") + amount).toFixed(2),
              spendingBalance: (parseFloat(child.spendingBalance || "0") + parseFloat(paymentAmounts.spendingAmount)).toFixed(2),
              savingsBalance: (parseFloat(child.savingsBalance || "0") + parseFloat(paymentAmounts.savingsAmount)).toFixed(2),
              rothIraBalance: (parseFloat(child.rothIraBalance || "0") + parseFloat(paymentAmounts.rothIraAmount)).toFixed(2),
              brokerageBalance: (parseFloat(child.brokerageBalance || "0") + parseFloat(paymentAmounts.brokerageAmount)).toFixed(2),
              completedJobs: (child.completedJobs || 0) + 1
            });
          }
        }
      }

      res.json(updatedJob);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/jobs/:id", verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJob(jobId);
      
      if (!job || job.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Only parents can delete jobs
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can delete jobs" });
      }

      // If job was approved, need to reverse the payment and update child balances
      if (job.status === "approved") {
        const payments = await storage.getPaymentsByFamily(req.user.familyId);
        const jobPayment = payments.find(p => p.jobId === jobId);
        
        if (jobPayment) {
          // Reverse the payment amounts from child balances
          const child = await storage.getChild(job.assignedToId);
          if (child) {
            await storage.updateChild(job.assignedToId, {
              totalEarned: (parseFloat(child.totalEarned || "0") - parseFloat(jobPayment.amount)).toFixed(2),
              spendingBalance: (parseFloat(child.spendingBalance || "0") - parseFloat(jobPayment.spendingAmount)).toFixed(2),
              savingsBalance: (parseFloat(child.savingsBalance || "0") - parseFloat(jobPayment.savingsAmount)).toFixed(2),
              rothIraBalance: (parseFloat(child.rothIraBalance || "0") - parseFloat(jobPayment.rothIraAmount)).toFixed(2),
              brokerageBalance: (parseFloat(child.brokerageBalance || "0") - parseFloat(jobPayment.brokerageAmount)).toFixed(2),
              completedJobs: Math.max((child.completedJobs || 0) - 1, 0)
            });
          }
        }
      }

      // Delete associated payments
      await storage.deletePaymentsByJob(jobId);
      
      const success = await storage.deleteJob(jobId);
      
      if (success) {
        res.json({ message: "Job deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete job" });
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get payment details for a specific job
  app.get("/api/payments/job/:jobId", verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getJob(jobId);
      
      if (!job || job.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Get all payments for the family and filter by jobId
      const payments = await storage.getPaymentsByFamily(req.user.familyId);
      const jobPayment = payments.find(p => p.jobId === jobId);
      
      if (jobPayment) {
        res.json(jobPayment);
      } else {
        res.status(404).json({ message: "Payment not found for this job" });
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update payment allocation for a completed job
  app.patch("/api/payments/job/:jobId", verifyToken, async (req: any, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const job = await storage.getJob(jobId);
      
      if (!job || job.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can update payment allocations" });
      }

      if (job.status !== "approved") {
        return res.status(400).json({ message: "Can only update payments for approved jobs" });
      }

      // Get existing payment
      const payments = await storage.getPaymentsByFamily(req.user.familyId);
      const existingPayment = payments.find(p => p.jobId === jobId);
      
      if (!existingPayment) {
        return res.status(404).json({ message: "Payment not found for this job" });
      }

      const { spendingAmount, savingsAmount, rothIraAmount, brokerageAmount } = req.body;
      
      // Validate allocation totals match job amount
      const total = parseFloat(spendingAmount) + parseFloat(savingsAmount) + parseFloat(rothIraAmount) + parseFloat(brokerageAmount);
      const jobAmount = parseFloat(job.amount);
      
      if (Math.abs(total - jobAmount) > 0.01) {
        return res.status(400).json({ 
          message: `Total allocation ($${total.toFixed(2)}) must equal job amount ($${jobAmount.toFixed(2)})` 
        });
      }

      // Calculate differences
      const spendingDiff = parseFloat(spendingAmount) - parseFloat(existingPayment.spendingAmount);
      const savingsDiff = parseFloat(savingsAmount) - parseFloat(existingPayment.savingsAmount);
      const rothIraDiff = parseFloat(rothIraAmount) - parseFloat(existingPayment.rothIraAmount);
      const brokerageDiff = parseFloat(brokerageAmount) - parseFloat(existingPayment.brokerageAmount);

      // Update child balances
      const child = await storage.getChild(job.assignedToId);
      if (child) {
        await storage.updateChild(job.assignedToId, {
          spendingBalance: (parseFloat(child.spendingBalance || "0") + spendingDiff).toFixed(2),
          savingsBalance: (parseFloat(child.savingsBalance || "0") + savingsDiff).toFixed(2),
          rothIraBalance: (parseFloat(child.rothIraBalance || "0") + rothIraDiff).toFixed(2),
          brokerageBalance: (parseFloat(child.brokerageBalance || "0") + brokerageDiff).toFixed(2),
        });
      }

      // Update the existing payment record
      const updatedPayment = await storage.updatePayment(existingPayment.id, {
        spendingAmount: spendingAmount.toString(),
        savingsAmount: savingsAmount.toString(),
        rothIraAmount: rothIraAmount.toString(),
        brokerageAmount: brokerageAmount.toString(),
      });

      res.json({ 
        message: "Payment allocation updated successfully",
        payment: updatedPayment,
        balanceChanges: {
          spendingDiff,
          savingsDiff,
          rothIraDiff,
          brokerageDiff
        }
      });
    } catch (error) {
      console.error("Error updating payment allocation:", error);
      res.status(500).json({ message: "Internal server error", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Allocation settings routes
  app.get("/api/allocation/:childId", verifyToken, async (req: any, res) => {
    try {
      const childId = parseInt(req.params.childId);
      const child = await storage.getChild(childId);
      
      if (!child || child.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Child not found" });
      }

      const settings = await storage.getAllocationSettings(childId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/allocation/:childId", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can update allocation settings" });
      }

      const childId = parseInt(req.params.childId);
      const child = await storage.getChild(childId);
      
      if (!child || child.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Child not found" });
      }

      // Add childId to the request body for schema validation
      const requestData = { ...req.body, childId };
      const allocationData = insertAllocationSettingsSchema.parse(requestData);
      
      // Validate percentages sum to 100
      const total = (allocationData.spendingPercentage || 0) + (allocationData.savingsPercentage || 0) + 
                   (allocationData.rothIraPercentage || 0) + (allocationData.brokeragePercentage || 0);
      if (total !== 100) {
        return res.status(400).json({ message: "Percentages must sum to 100" });
      }

      const updatedSettings = await storage.updateAllocationSettings(childId, allocationData);
      res.json(updatedSettings);
    } catch (error) {
      res.status(400).json({ message: "Invalid allocation data" });
    }
  });

  // Account Types routes
  app.get("/api/account-types/:familyId", verifyToken, async (req: any, res) => {
    try {
      const familyId = parseInt(req.params.familyId);
      
      // Verify user has access to this family
      if (req.user.familyId !== familyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const accountTypes = await storage.getAccountTypes(familyId);
      if (!accountTypes) {
        // Create default account types if none exist
        const defaultAccountTypes = await storage.createAccountTypes({
          familyId,
          spendingEnabled: true,
          savingsEnabled: true,
          rothIraEnabled: false,
          brokerageEnabled: false
        });
        return res.json(defaultAccountTypes);
      }
      
      res.json(accountTypes);
    } catch (error) {
      console.error('Account types GET error:', error);
      res.status(500).json({ message: "Internal server error", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.put("/api/account-types/:familyId", verifyToken, async (req: any, res) => {
    try {
      const familyId = parseInt(req.params.familyId);
      
      console.log('PUT account-types request:', { familyId, user: req.user, body: req.body });
      
      // Only parents can update account types
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can update account types" });
      }

      // Verify user has access to this family
      if (req.user.familyId !== familyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const accountTypesData = req.body;
      const updatedAccountTypes = await storage.updateAccountTypes(familyId, accountTypesData);
      
      if (!updatedAccountTypes) {
        return res.status(404).json({ message: "Account types not found" });
      }

      // Update allocation settings for all children in the family when account types change
      const children = await storage.getChildrenByFamily(familyId);
      
      for (const child of children) {
        // Get current allocation settings
        const currentAllocation = await storage.getAllocationSettings(child.id);
        
        // Calculate enabled accounts and redistribute percentages
        const enabledAccounts = [];
        if (accountTypesData.spendingEnabled) enabledAccounts.push('spending');
        if (accountTypesData.savingsEnabled) enabledAccounts.push('savings');
        if (accountTypesData.rothIraEnabled) enabledAccounts.push('rothIra');
        if (accountTypesData.brokerageEnabled) enabledAccounts.push('brokerage');
        
        if (enabledAccounts.length > 0) {
          // Calculate equal distribution
          const equalPercentage = Math.floor(100 / enabledAccounts.length);
          const remainder = 100 - (equalPercentage * enabledAccounts.length);
          
          const newAllocation = {
            spendingPercentage: accountTypesData.spendingEnabled 
              ? equalPercentage + (enabledAccounts[0] === 'spending' ? remainder : 0) 
              : 0,
            savingsPercentage: accountTypesData.savingsEnabled 
              ? equalPercentage + (enabledAccounts[0] === 'savings' ? remainder : 0) 
              : 0,
            rothIraPercentage: accountTypesData.rothIraEnabled 
              ? equalPercentage + (enabledAccounts[0] === 'rothIra' ? remainder : 0) 
              : 0,
            brokeragePercentage: accountTypesData.brokerageEnabled 
              ? equalPercentage + (enabledAccounts[0] === 'brokerage' ? remainder : 0) 
              : 0,
          };
          
          if (currentAllocation) {
            await storage.updateAllocationSettings(child.id, newAllocation);
          } else {
            await storage.createAllocationSettings({
              childId: child.id,
              ...newAllocation,
            });
          }
        }
      }
      
      res.json(updatedAccountTypes);
    } catch (error) {
      console.error('Account types PUT error:', error);
      res.status(400).json({ message: "Invalid account types data", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Payments routes
  app.get("/api/payments", verifyToken, async (req: any, res) => {
    try {
      let payments;
      if (req.user.role === "parent") {
        payments = await storage.getPaymentsByFamily(req.user.familyId);
      } else {
        // Find child ID for this user
        const children = await storage.getChildrenByFamily(req.user.familyId);
        const child = children.find(c => c.userId === req.user.id);
        if (!child) {
          return res.status(404).json({ message: "Child profile not found" });
        }
        payments = await storage.getPaymentsByChild(child.id);
      }
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Lessons routes
  app.get("/api/lessons", verifyToken, async (req: any, res) => {
    try {
      const { category } = req.query;
      let lessons;
      
      if (category) {
        lessons = await storage.getLessonsByCategory(category as string);
      } else {
        // Get all default lessons and custom lessons for this family
        const defaultLessons = Array.from(["earning", "saving", "spending", "investing", "donating"])
          .flatMap(async cat => await storage.getLessonsByCategory(cat));
        const customLessons = await storage.getCustomLessons(req.user.familyId);
        lessons = [...await Promise.all(defaultLessons), ...customLessons].flat();
      }
      
      res.json(lessons);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/lessons", verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can create custom lessons" });
      }

      const lessonData = insertLessonSchema.parse({
        ...req.body,
        isCustom: true,
        familyId: req.user.familyId
      });

      const lesson = await storage.createLesson(lessonData);
      res.json(lesson);
    } catch (error) {
      res.status(400).json({ message: "Invalid lesson data" });
    }
  });

  // Learning progress routes
  app.get("/api/learning-progress", verifyToken, async (req: any, res) => {
    try {
      let childId;
      
      if (req.user.role === "parent") {
        childId = req.query.childId ? parseInt(req.query.childId as string) : null;
        if (!childId) {
          return res.status(400).json({ message: "Child ID required for parents" });
        }
      } else {
        // Find child ID for this user
        const children = await storage.getChildrenByFamily(req.user.familyId);
        const child = children.find(c => c.userId === req.user.id);
        if (!child) {
          return res.status(404).json({ message: "Child profile not found" });
        }
        childId = child.id;
      }

      const progress = await storage.getLearningProgress(childId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Achievements routes
  app.get("/api/achievements", verifyToken, async (req: any, res) => {
    try {
      let childId;
      
      if (req.user.role === "parent") {
        childId = req.query.childId ? parseInt(req.query.childId as string) : null;
        if (!childId) {
          return res.status(400).json({ message: "Child ID required for parents" });
        }
      } else {
        // Find child ID for this user
        const children = await storage.getChildrenByFamily(req.user.familyId);
        const child = children.find(c => c.userId === req.user.id);
        if (!child) {
          return res.status(404).json({ message: "Child profile not found" });
        }
        childId = child.id;
      }

      const achievements = await storage.getAchievements(childId);
      res.json(achievements);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard stats route
  app.get("/api/dashboard-stats", verifyToken, async (req: any, res) => {
    try {
      let childId;
      
      if (req.user.role === "parent") {
        childId = req.query.childId ? parseInt(req.query.childId as string) : null;
        if (!childId) {
          const children = await storage.getChildrenByFamily(req.user.familyId);
          childId = children[0]?.id;
        }
      } else {
        // Find child ID for this user
        const children = await storage.getChildrenByFamily(req.user.familyId);
        const child = children.find(c => c.userId === req.user.id);
        if (!child) {
          return res.status(404).json({ message: "Child profile not found" });
        }
        childId = child.id;
      }

      if (!childId) {
        return res.status(404).json({ message: "No child found" });
      }

      const child = await storage.getChild(childId);
      const allocation = await storage.getAllocationSettings(childId);
      const jobs = await storage.getJobsByChild(childId);
      const payments = await storage.getPaymentsByChild(childId);
      const achievements = await storage.getAchievements(childId);
      const progress = await storage.getLearningProgress(childId);

      const activeJobs = jobs.filter(job => job.status !== "approved");
      const totalEarned = parseFloat(child?.totalEarned || "0");

      res.json({
        child,
        allocation,
        activeJobs,
        totalEarned,
        completedJobs: child?.completedJobs || 0,
        learningStreak: child?.learningStreak || 0,
        achievements: achievements.slice(0, 3),
        learningProgress: progress
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
