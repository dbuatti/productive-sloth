// Find the renderScheduleCore function inside SchedulerPage.tsx and update it:

const renderScheduleCore = () => (
  <>
    {/* 1. Context Bar: Only receives T_current now */}
    <div className="hidden lg:block">
      <SchedulerContextBar T_current={T_current} />
    </div>

    {/* 2. Input Card: Receives all the command/input props */}
    <Card className="p-4 shadow-md animate-hover-lift">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <ListTodo className="h-6 w-6 text-primary" /> Command Input
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

    {/* 3. Action Center */}
    <div className="hidden lg:block animate-slide-in-up">
      <SchedulerActionCenter 
        isProcessingCommand={isProcessingCommand}
        dbScheduledTasks={dbScheduledTasks}
        retiredTasksCount={retiredTasks.length}
        sortBy={sortBy}
        onAutoSchedule={handleAutoScheduleDay}
        onCompactSchedule={handleCompactSchedule}
        onRandomizeBreaks={handleRandomizeBreaks}
        onZoneFocus={handleZoneFocus}
        onRechargeEnergy={async () => rechargeEnergy()}
        onQuickBreak={handleQuickBreakButton}
        onQuickScheduleBlock={handleQuickScheduleBlock}
        onSortFlexibleTasks={handleSortFlexibleTasks}
        onAetherDump={handleAetherDumpButton}
        onAetherDumpMega={handleAetherDumpMegaButton}
        onRefreshSchedule={handleRefreshSchedule}
        onOpenWorkdayWindowDialog={() => setShowWorkdayWindowDialog(true)}
        onStartRegenPod={handleStartRegenPod}
        hasFlexibleTasksOnCurrentDay={hasFlexibleTasksOnCurrentDay}
      />
    </div>

    {/* ... rest of the render logic */}
  </>
);