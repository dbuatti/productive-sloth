allTasks.forEach(task => {
  if (task.name.toLowerCase().includes(lowerInput) && !filteredSuggestions.some(s => s.name === task.name)) {
    filteredSuggestions.push({ type: 'task', name: task.name, description: `Task: ${task.name}` });
  }
});