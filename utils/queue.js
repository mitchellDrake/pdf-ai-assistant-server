// queue.js
const crypto = require('crypto');

class TaskQueue {
  constructor() {
    this.queue = [];
    this.running = false;
    this.subscribers = [];
  }

  // Add a task
  add(fn, name, pdfId) {
    const task = {
      id: crypto.randomUUID(),
      name,
      pdfId,
      fn,
      status: 'pending',
    };
    this.queue.push(task);
    this.notify(task); // notify initial status
    this.run();
    return task.id;
  }

  // List tasks with optional filtering
  list(filter) {
    return this.queue.filter((t) => {
      if (filter?.name && t.name !== filter.name) return false;
      if (filter?.status && t.status !== filter.status) return false;
      if (filter?.pdfId && t.pdfId !== filter.pdfId) return false;
      return true;
    });
  }

  // Subscribe to task updates
  subscribe(sub) {
    this.subscribers.push(sub);
    // return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== sub);
    };
  }

  // Notify all subscribers about a task
  notify(task) {
    this.subscribers.forEach((sub) => sub(task));
  }

  // Run tasks sequentially
  async run() {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const task = this.queue.find((t) => t.status === 'pending');
      if (!task) break;

      task.status = 'running';
      this.notify(task);

      try {
        await task.fn();
        task.status = 'done';
      } catch (err) {
        task.status = 'failed';
        task.error = err;
        console.error('Task failed:', err);
      }

      this.notify(task);
    }

    this.running = false;
  }
}

// Singleton instance
const taskQueue = new TaskQueue();

module.exports = { taskQueue };
