import express from "express";
import { lifeosService } from "../services/lifeos-service.js";

export const tasksRoutes = express.Router();

export type TaskCategory = "MUST_DO" | "SHOULD_DO" | "NICE_TO_DO";

export interface CustomTask {
  id: string;
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  category?: TaskCategory;
  tag?: "scheduled" | "location" | "person" | "preparation";
  eventContext?: string;
  dueDate?: string;
  completed: boolean;
  createdAt: string;
}

const customTasks: Map<string, CustomTask> = new Map([
  [
    "task_prep_insurance",
    {
      id: "task_prep_insurance",
      title: "Take health insurance card & policy documents",
      description: "Required for Doctor Appointment check-in at City Specialty Hospital.",
      priority: "high",
      category: "MUST_DO",
      tag: "preparation",
      eventContext: "Doctor Appointment — Dr. Priya Nair",
      dueDate: new Date().toISOString(),
      completed: false,
      createdAt: new Date().toISOString(),
    }
  ],
  [
    "task_prep_lab_reports",
    {
      id: "task_prep_lab_reports",
      title: "Bring previous blood test & lab reports",
      description: "Dr. Priya requested recent lipid profile and CBC results.",
      priority: "high",
      category: "MUST_DO",
      tag: "preparation",
      eventContext: "Doctor Appointment — Dr. Priya Nair",
      dueDate: new Date().toISOString(),
      completed: false,
      createdAt: new Date().toISOString(),
    }
  ],
  [
    "task_prep_slides",
    {
      id: "task_prep_slides",
      title: "Submit sprint review deck before meeting",
      description: "Send PDF to Anand Menon and Sneha Rao.",
      priority: "medium",
      category: "SHOULD_DO",
      tag: "scheduled",
      eventContext: "Q3 Product & Architecture Review",
      dueDate: new Date().toISOString(),
      completed: false,
      createdAt: new Date().toISOString(),
    }
  ],
  [
    "task_pickup_meds",
    {
      id: "task_pickup_meds",
      title: "Pick up prescription from Apollo Pharmacy",
      description: "Order #RX-9921 is ready near MG Road.",
      priority: "medium",
      category: "SHOULD_DO",
      tag: "location",
      eventContext: "General Errands",
      dueDate: new Date().toISOString(),
      completed: false,
      createdAt: new Date().toISOString(),
    }
  ]
]);

tasksRoutes.get("/", (req, res) => {
  try {
    const derived = lifeosService.deriveTasks();
    const { priority, eventContext, completed } = req.query;

    const derivedMapped: CustomTask[] = derived.map((d: any) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      priority: d.priority,
      category: (d.priority === "high" ? "MUST_DO" : d.priority === "medium" ? "SHOULD_DO" : "NICE_TO_DO") as TaskCategory,
      tag: "preparation" as const,
      eventContext: d.context?.[0] || "General Preparation",
      dueDate: d.dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
    }));

    const allTasks: CustomTask[] = [
      ...Array.from(customTasks.values()),
      ...derivedMapped,
    ];

    const uniqueMap = new Map<string, CustomTask>();
    allTasks.forEach(t => uniqueMap.set(t.id, t));
    let result = Array.from(uniqueMap.values());

    if (priority) {
      result = result.filter(t => t.priority === priority);
    }
    if (eventContext) {
      result = result.filter(t => t.eventContext?.toLowerCase().includes((eventContext as string).toLowerCase()));
    }
    if (completed !== undefined) {
      const isComp = completed === "true";
      result = result.filter(t => t.completed === isComp);
    }

    const eventGroups: Record<string, CustomTask[]> = {};
    result.forEach(t => {
      const groupName = t.eventContext || "General";
      if (!eventGroups[groupName]) eventGroups[groupName] = [];
      eventGroups[groupName].push(t);
    });

    res.json({
      success: true,
      count: result.length,
      data: result,
      eventGroups,
      summary: {
        mustDo: result.filter(t => t.priority === "high" && !t.completed).length,
        shouldDo: result.filter(t => t.priority === "medium" && !t.completed).length,
        niceToDo: result.filter(t => t.priority === "low" && !t.completed).length,
        completed: result.filter(t => t.completed).length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

tasksRoutes.get("/high-priority", (_req, res) => {
  try {
    const tasks = Array.from(customTasks.values()).filter(t => t.priority === "high" && !t.completed);
    res.json({
      success: true,
      count: tasks.length,
      data: tasks,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

tasksRoutes.post("/", (req, res) => {
  try {
    const { title, description, priority, category, tag, eventContext, dueDate } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const newTask: CustomTask = {
      id: `task_${Date.now()}`,
      title,
      description,
      priority: priority || "medium",
      category: category || (priority === "high" ? "MUST_DO" : "SHOULD_DO"),
      tag: tag || "preparation",
      eventContext: eventContext || "General",
      dueDate: dueDate || new Date().toISOString(),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    customTasks.set(newTask.id, newTask);

    res.json({
      success: true,
      data: newTask,
      message: "Task created",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

tasksRoutes.patch("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const task = customTasks.get(id as string);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const { completed, title, description, priority, eventContext } = req.body;
    if (completed !== undefined) task.completed = completed;
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (eventContext !== undefined) task.eventContext = eventContext;

    customTasks.set(task.id, task);

    res.json({
      success: true,
      data: task,
      message: "Task updated",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

tasksRoutes.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const deleted = customTasks.delete(id as string);
    res.json({
      success: deleted,
      message: deleted ? "Task deleted" : "Task not found",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
