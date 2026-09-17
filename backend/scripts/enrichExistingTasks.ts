import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Task Resource Enrichment ---');

  // 1. Django Goal Tasks
  const djangoGoalId = '287e74c5-ba76-4cd3-9fd0-fbe9ac6c4215';
  const djangoTasks = await prisma.dailyTask.findMany({
    where: { goalId: djangoGoalId },
    orderBy: { dayNumber: 'asc' }
  });

  const djangoStepResources: Record<number, Record<number, { title: string; url: string; type: 'youtube_video' | 'documentation' | 'scientific_study' | 'interactive_tool' | 'guide'; why: string }>> = {
    1: {
      1: {
        title: 'VS Code Setup for Python (Complete Walkthrough)',
        url: 'https://www.youtube.com/watch?v=VCHUKe1e-m4',
        type: 'youtube_video',
        why: 'Watch the first 4 minutes to set up VS Code and configure the official Python extension.'
      },
      2: {
        title: 'Python 3 Windows Installation & PATH Verification',
        url: 'https://docs.python.org/3/using/windows.html',
        type: 'documentation',
        why: 'Ensure the "Add Python to PATH" box is checked in the installer.'
      },
      3: {
        title: 'Python Tutor: Visual Code Execution Tracer',
        url: 'https://pythontutor.com/visualize.html',
        type: 'interactive_tool',
        why: 'Step through your hello world script line-by-line to see how the Python runtime executes code.'
      },
      4: {
        title: 'Real Python: Interacting with the Python REPL',
        url: 'https://realpython.com/interacting-with-python/',
        type: 'guide',
        why: 'Follow the cheatsheet to experiment with rapid expression evaluation inside your terminal.'
      }
    },
    2: {
      1: {
        title: 'Programming with Mosh: Python Variables & Data Types',
        url: 'https://www.youtube.com/watch?v=_uQrJ0TkZlc',
        type: 'youtube_video',
        why: 'Watch minute 08:30 to 14:00 to understand dynamic typing and variable allocation.'
      },
      2: {
        title: 'W3Schools Interactive Python Numbers Sandbox',
        url: 'https://www.w3schools.com/python/python_numbers.asp',
        type: 'interactive_tool',
        why: 'Practice integer vs float division and exponent arithmetic directly in the browser sandbox.'
      },
      3: {
        title: 'Official Python Docs: Common String Methods & F-Strings',
        url: 'https://docs.python.org/3/library/stdtypes.html#string-methods',
        type: 'documentation',
        why: 'Reference formatted string literals (f-strings) and formatting methods like strip and lower.'
      },
      4: {
        title: 'Real Python: Explicit Type Casting & Coercion Guide',
        url: 'https://realpython.com/python-type-casting/',
        type: 'guide',
        why: 'Follow the conversion rules to safely convert string inputs into integers and floats without crashing.'
      }
    },
    3: {
      1: {
        title: 'Dr. Pascual-Leone: Neurological Consolidation of Deliberate Reps',
        url: 'https://pubmed.ncbi.nlm.nih.gov/7500130/',
        type: 'scientific_study',
        why: 'Read evidence demonstrating that 15 minutes of quiet mental review consolidates neural motor/coding schemas.'
      }
    },
    4: {
      1: {
        title: 'W3Schools Interactive Python Operators Playground',
        url: 'https://www.w3schools.com/python/python_operators.asp',
        type: 'interactive_tool',
        why: 'Practice arithmetic, comparison, and modulus operations with instant feedback.'
      },
      2: {
        title: 'Official Python Reference: Boolean Expressions & Operator Precedence',
        url: 'https://docs.python.org/3/reference/expressions.html#boolean-operations',
        type: 'documentation',
        why: 'Consult the operator precedence hierarchy table to avoid logical precedence bugs.'
      },
      3: {
        title: 'Corey Schafer: Python User Input & Parsing Guide',
        url: 'https://www.youtube.com/watch?v=k9TUPpGqYTo',
        type: 'youtube_video',
        why: 'Watch from 03:00 to 07:30 to learn prompt formatting and handling raw user inputs.'
      },
      4: {
        title: 'GeeksforGeeks: Build a Simple CLI Calculator in Python',
        url: 'https://www.geeksforgeeks.org/make-a-simple-calculator-using-python/',
        type: 'guide',
        why: 'Compare your operator handling and error catching against this structured CLI pattern.'
      }
    },
    5: {
      1: {
        title: 'freeCodeCamp: Python Conditionals and Branching Walkthrough',
        url: 'https://www.youtube.com/watch?v=DZwmZ8Usvnk',
        type: 'youtube_video',
        why: 'Follow the flowchart breakdown of if/else logic to visualize condition branching.'
      },
      2: {
        title: 'Official Python Docs: if Statements & elif Syntax',
        url: 'https://docs.python.org/3/tutorial/controlflow.html#if-statements',
        type: 'documentation',
        why: 'Study the official control flow specification for sequential branch evaluation.'
      },
      3: {
        title: 'Python Tutor: Trace Nested Conditionals in Real-Time',
        url: 'https://pythontutor.com/visualize.html',
        type: 'interactive_tool',
        why: 'Watch execution arrows step into or skip branches based on dynamic boolean evaluations.'
      },
      4: {
        title: 'Real Python: Conditional Statements & Guard Clauses Guide',
        url: 'https://realpython.com/python-conditional-statements/',
        type: 'guide',
        why: 'Learn how to use guard clauses to prevent deep nesting and keep code clean.'
      }
    },
    6: {
      1: {
        title: 'Corey Schafer: Python Loops and Iterations (For & While)',
        url: 'https://www.youtube.com/watch?v=6iF8Xb7Z3wQ',
        type: 'youtube_video',
        why: 'Watch how range() works under the hood to iterate without allocating excessive memory.'
      },
      2: {
        title: 'W3Schools Interactive Python While Loops Simulator',
        url: 'https://www.w3schools.com/python/python_while_loops.asp',
        type: 'interactive_tool',
        why: 'Test conditional loop termination in the sandbox to prevent infinite loops.'
      },
      3: {
        title: 'Official Python Tutorial: break, continue, and else Clauses on Loops',
        url: 'https://docs.python.org/3/tutorial/controlflow.html#break-and-continue-statements-and-else-clauses-on-loops',
        type: 'documentation',
        why: 'Review the subtle behavior of the loop else block when no break is encountered.'
      },
      4: {
        title: 'Real Python: Building Timers & Delays in Python',
        url: 'https://realpython.com/python-timer/',
        type: 'guide',
        why: 'Implement time.sleep() inside your loop to pace terminal output cleanly.'
      }
    },
    7: {
      1: {
        title: 'Programming with Mosh: Python Functions (Parameters & Return)',
        url: 'https://www.youtube.com/watch?v=u-OmVr_fT4s',
        type: 'youtube_video',
        why: 'Watch the step-by-step breakdown of defining functions and organizing modular code.'
      },
      2: {
        title: 'Official Python Tutorial: Defining Functions and Scope Rules',
        url: 'https://docs.python.org/3/tutorial/controlflow.html#defining-functions',
        type: 'documentation',
        why: 'Review local variable scope versus global scope when passing parameters.'
      },
      3: {
        title: 'Python Tutor: Function Call Stack & Frame Visualization',
        url: 'https://pythontutor.com/visualize.html',
        type: 'interactive_tool',
        why: 'See how the stack pushes and pops memory frames during function invocations.'
      },
      4: {
        title: 'Real Python: Defining Your Own Python Functions (Master Guide)',
        url: 'https://realpython.com/defining-your-own-python-function/',
        type: 'guide',
        why: 'Check best practices for writing clean docstrings and type annotations.'
      }
    }
  };

  for (const task of djangoTasks) {
    const dayMap = djangoStepResources[task.dayNumber];
    if (dayMap) {
      const steps = JSON.parse(task.detailedSteps);
      const updatedSteps = steps.map((s: any) => {
        const res = dayMap[s.stepNumber];
        if (res) {
          return {
            ...s,
            resourceTitle: res.title,
            resourceUrl: res.url,
            resourceType: res.type,
            resourceWhy: res.why
          };
        }
        return s;
      });

      await prisma.dailyTask.update({
        where: { id: task.id },
        data: {
          detailedSteps: JSON.stringify(updatedSteps)
        }
      });
      console.log(`Updated Django Task Day ${task.dayNumber} with ${updatedSteps.length} specific resources.`);
    }
  }

  // 2. Guitar Goal Tasks
  const guitarGoalId = '859d98aa-a93e-4931-9cf2-7e3d83feffc6';
  const guitarTasks = await prisma.dailyTask.findMany({
    where: { goalId: guitarGoalId }
  });

  for (const task of guitarTasks) {
    const steps = JSON.parse(task.detailedSteps);
    const updatedSteps = steps.map((s: any) => {
      // Fix any Python links or generic links
      if (s.title.toLowerCase().includes('posture') || s.title.toLowerCase().includes('introduction')) {
        return {
          ...s,
          resourceTitle: 'JustinGuitar: First Guitar Lesson & Posture Mechanics',
          resourceUrl: 'https://www.youtube.com/watch?v=BBz-Jyr23M4',
          resourceType: 'youtube_video',
          resourceWhy: 'Follow Justin from 01:30 to 05:00 for the exact sitting posture, thumb position, and hand angle.'
        };
      }
      if (s.title.toLowerCase().includes('fretting') || s.title.toLowerCase().includes('finger')) {
        return {
          ...s,
          resourceTitle: 'JustinGuitar: The Finger Gym & Fretting Technique',
          resourceUrl: 'https://www.youtube.com/watch?v=F3a37v_1F-M',
          resourceType: 'youtube_video',
          resourceWhy: 'Watch the fingertip placement demonstration right next to the fret wire without string buzz.'
        };
      }
      if (s.title.toLowerCase().includes('chord') || s.title.toLowerCase().includes('minor') || s.title.toLowerCase().includes('major')) {
        return {
          ...s,
          resourceTitle: 'JustinGuitar: E Minor & C Major Chord Mechanics',
          resourceUrl: 'https://www.youtube.com/watch?v=nC82a3-fP7M',
          resourceType: 'youtube_video',
          resourceWhy: 'See how to arch the fingers so the adjacent strings ring out clearly with zero muting.'
        };
      }
      if (s.title.toLowerCase().includes('metronome') || s.title.toLowerCase().includes('tempo')) {
        return {
          ...s,
          resourceTitle: 'FluteTunes Interactive BPM Metronome',
          resourceUrl: 'https://www.flutetunes.com/metronome/',
          resourceType: 'interactive_tool',
          resourceWhy: 'Set this metronome to 60 BPM and practice 1 strum per click before speeding up.'
        };
      }
      if (s.title.toLowerCase().includes('mental') || s.title.toLowerCase().includes('visualiz')) {
        return {
          ...s,
          resourceTitle: 'Dr. Pascual-Leone: Motor Cortex Plasticity from Mental Rehearsal',
          resourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/7500130/',
          resourceType: 'scientific_study',
          resourceWhy: 'Study demonstrating that mental rehearsal triggers the same synaptic consolidation as physical chord changes.'
        };
      }
      if (s.title.toLowerCase().includes('recovery') || s.title.toLowerCase().includes('rest')) {
        return {
          ...s,
          resourceTitle: 'Farnam Street: Deliberate Rest & Habit Reflection Protocol',
          resourceUrl: 'https://fs.blog/weekly-review/',
          resourceType: 'guide',
          resourceWhy: 'Follow this reflection format to review chord transition friction and plan the upcoming week.'
        };
      }
      return {
        ...s,
        resourceTitle: 'JustinGuitar: Beginner Practice Routine & Sub-Skills Guide',
        resourceUrl: 'https://www.justinguitar.com/classes/beginner-guitar-course-grade-1',
        resourceType: 'guide',
        resourceWhy: 'Follow the 5-minute practice block structure to maximize muscle memory.'
      };
    });

    await prisma.dailyTask.update({
      where: { id: task.id },
      data: {
        detailedSteps: JSON.stringify(updatedSteps),
        resourceTitle: 'JustinGuitar Beginner Grade 1 Course',
        resourceUrl: 'https://www.justinguitar.com/classes/beginner-guitar-course-grade-1',
        resourceType: 'video',
        resourceWhy: 'The premier structured guitar curriculum for beginner mechanics and clean transitions.'
      }
    });
  }

  console.log('--- Task Resource Enrichment Completed Successfully ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
