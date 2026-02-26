interface Step {
  label: string;
  description: string;
}

const steps: Step[] = [
  { label: 'Create account', description: 'Email & password' },
  { label: 'Verify email', description: 'Check your inbox' },
  { label: 'Add payment', description: 'Card details' },
];

interface SignupStepperProps {
  current: 0 | 1 | 2;
}

export default function SignupStepper({ current }: SignupStepperProps) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                i < current
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : i === current
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-gray-200 text-gray-400 bg-white'
              }`}
            >
              {i < current ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-xs mt-1 font-medium ${
                i === current ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 w-16 mx-1 mb-4 ${i < current ? 'bg-blue-600' : 'bg-gray-200'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
