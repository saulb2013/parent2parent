import { Fragment } from 'react';

const STEPS = ['Pending', 'Paid', 'In Transit', 'Delivered'];

function getStepIndex(orderStatus) {
  if (orderStatus === 'delivered') return 3;
  if (orderStatus === 'shipped')   return 2;
  if (orderStatus === 'paid')      return 1;
  return 0; // pending
}

function Check({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function OrderStepper({ status, deliveryMethod, hasTracking, size = 'sm' }) {
  if (status === 'cancelled' || status === 'refunded') {
    const label = status === 'cancelled' ? 'Cancelled' : 'Refunded';
    const cls = status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
  }

  const stepIndex = getStepIndex(status);
  const isDelivery = deliveryMethod === 'delivery';
  const labels = [...STEPS];
  if (isDelivery && hasTracking && stepIndex >= 1) labels[1] = 'Courier Booked';

  const large = size === 'lg';

  return (
    <div className="flex items-center w-full">
      {labels.map((label, i) => {
        const done = i <= stepIndex;
        const isCurrent = i === stepIndex;
        return (
          <Fragment key={i}>
            <div className="flex flex-col items-center shrink-0">
              <div className={`rounded-full flex items-center justify-center ${
                large ? 'w-6 h-6' : 'w-4 h-4'
              } ${
                done
                  ? `bg-primary text-white ${isCurrent ? 'ring-[3px] ring-primary/15' : ''}`
                  : 'border-2 border-gray-300'
              }`}>
                {done && <Check className={large ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'} />}
              </div>
              <span className={`whitespace-nowrap ${large ? 'text-[11px] mt-1.5' : 'text-[9px] mt-0.5'} ${
                done ? 'text-primary font-semibold' : 'text-gray-400'
              }`}>{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div className={`flex-1 mx-1.5 rounded-full self-start ${
                large ? 'h-[3px] mt-[11px]' : 'h-[2px] mt-[7px]'
              } ${
                i < stepIndex ? 'bg-primary' : 'bg-gray-200'
              }`} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
