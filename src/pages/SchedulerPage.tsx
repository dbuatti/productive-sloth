// ... existing imports

const SchedulerPage: React.FC<SchedulerPageProps> = ({ view }) => {
  // ... existing hooks (user, profile, T_current, etc.)

  const renderScheduleCore = () => (
    <>
      {/* FIX 1: SchedulerContextBar call (removed extra input props) */}
      <div className="hidden lg:block">
        <SchedulerContextBar T_current={T_current} />
      </div>

      <Card className="p-4 shadow-md animate-hover-lift">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" /> Command Input
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* FIX 2: Moved input logic to the correct component */}
          <SchedulerInput 
            onCommand={async (val) => { 
              setIsProcessing(true); 
              await handleCommand(val); 
              setIsProcessing(false); 
              setInputValue(''); 
            }} 
            isLoading={isProcessing} 
            inputValue={inputValue}
            setInputValue={setInputValue}
            placeholder="Add task (e.g., 'Gym 60')"
            onDetailedInject={() => setInjectionPrompt({ taskName: '', isOpen: true })}
          />
        </CardContent>
      </Card>

      <div className="hidden lg:block">
        <SchedulerActionCenter 
          // ... props
        />
      </div>

      <Card className="animate-pop-in border-white/10">
        <CardHeader><CardTitle>Timeline Hub</CardTitle></CardHeader>
        <CardContent>
          <SchedulerDisplay 
            // ... props
          />
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      {/* ... ImmersiveFocusMode and other modals */}

      <SchedulerDashboardPanel 
        // ... props
      />

      <Card className="p-4 shadow-xl">
        <CalendarStrip 
          // ... props
        />
        <SchedulerSegmentedControl currentView={view} />
      </Card>

      <div className="animate-slide-in-up">
        {view === 'schedule' && renderScheduleCore()}
        {view === 'sink' && (
           <AetherSink 
            // ... props
           />
        )}
        {view === 'recap' && (
          <DailyVibeRecapCard 
            // ... props
          />
        )}
      </div>

      {/* FIX 3: Correcting the mobile drawer call */}
      {isMobile && view === 'schedule' && (
        <Drawer>
          <DrawerTrigger asChild>
            <Button className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-2xl bg-primary">
              <Settings2 className="h-6 w-6" />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <div className="p-6 space-y-4">
              <SchedulerContextBar T_current={T_current} />
              <SchedulerActionCenter 
                // ... props
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* ... rest of the file */}
    </div>
  );
};

export default SchedulerPage;