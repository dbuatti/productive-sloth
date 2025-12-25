// Inside SchedulerPage.tsx...

const renderScheduleCore = () => (
  <div className="space-y-6">
    {/* 1. Dashboard Context (HUD Only) */}
    <div className="hidden lg:block">
      <SchedulerContextBar T_current={T_current} />
    </div>

    {/* 2. Command Input (Logic Only) */}
    <Card className="p-4 shadow-md bg-card/40 backdrop-blur-sm border-primary/10 animate-slide-in-up">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <ListTodo className="h-6 w-6 text-primary" /> Quick Add
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <SchedulerInput 
          onCommand={async (val) => { 
            setIsProcessingCommand(true); 
            await handleCommand(val); 
            setIsProcessingCommand(false); 
            setInputValue(''); 
          }} 
          isLoading={isProcessingCommand} 
          inputValue={inputValue}
          setInputValue={setInputValue}
          placeholder="Add task (e.g., 'Gym 60')"
          onDetailedInject={handleAddTaskClick}
        />
      </CardContent>
    </Card>

    {/* 3. Action Center & Rest of Content... */}
  </div>
);