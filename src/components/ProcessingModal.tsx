import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCircle2, Loader2 } from 'lucide-react';

interface ProcessingModalProps {
  isOpen: boolean;
  status: string;
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({ isOpen, status }) => {
  if (!isOpen) return null;

  const steps = [
    { text: 'Generating reading...', label: 'Drafting core content' },
    { text: 'Humanising language...', label: 'Refining rhythm & eliminating AI clichés' },
    { text: 'Checking level and vocabulary...', label: 'Validating CEFR & target expressions' },
    { text: 'Ready', label: 'Displaying natural reading' },
  ];

  const currentStepIndex = steps.findIndex(s => s.text === status);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#292B25]/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-md bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm p-6 sm:p-8 shadow-md"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-[#E5DED0] flex items-center justify-center text-[#73785E]">
              <Sparkles className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h3 className="font-editorial text-lg font-semibold text-[#292B25]">
                Humanise Reading Pipeline
              </h3>
              <p className="text-xs text-[#717265] font-ui">
                Crafting natural contextual reading
              </p>
            </div>
          </div>

          <div className="space-y-3.5 my-6">
            {steps.map((step, idx) => {
              const isPast = currentStepIndex > idx;
              const isCurrent = currentStepIndex === idx;

              return (
                <div key={step.text} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {isPast ? (
                      <CheckCircle2 className="w-4 h-4 text-[#73785E]" />
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 text-[#B49379] animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-[#D4CCBC]" />
                    )}
                  </div>
                  <div>
                    <p
                      className={`text-sm font-ui transition-colors ${
                        isCurrent
                          ? 'font-medium text-[#292B25]'
                          : isPast
                          ? 'text-[#73785E]'
                          : 'text-[#A5AA91]'
                      }`}
                    >
                      {step.text}
                    </p>
                    <p className="text-[11px] text-[#717265]">
                      {step.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-center text-[#717265] font-ui italic">
            Automatic Humanise ensures natural rhythm and authentic vocabulary usage.
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
