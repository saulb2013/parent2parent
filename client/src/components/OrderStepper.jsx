import { Fragment } from 'react';

const STEPS = ['Pending', 'Paid', 'In Transit', 'Delivered'];

function getStepIndex(orderStatus) {
  if (orderStatus === 'delivered') return 3;
  if (orderStatus === 'shipped')   return 2;
  if (orderStatus === 'paid')      return 1;
  return 0; // pending
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
  const dotSize = large ? 'w-7 h-7 text-xs' : 'w-5 h-5 text-[10px]';
  const checkSize = large ? 'w-4 h-4' : 'w-3 h-3';
  const labelSize = large ? 'text-xs mt-1.5' : 'text-[10px] mt-1';
  const lineHeight = large ? 'h-1' : 'h-0.5';
  const lineOffset = large ? 'mt-3.5' : 'mt-2.5';

  return (
    <div className="flex items-center w-full">
      {labels.map((label, i) => (
        <Fragment key={i}>
          <div className="flex flex-col items-center" style={{ minWidth: 0 }}>
            <div className={`${dotSize} rounded-full flex items-center justify-center font-bold shrink-0 ${
              i < stepIndex ? 'bg-primary text-white' :
              i === stepIndex ? 'bg-primary text-white ring-2 ring-primary/20' :
              'bg-gray-200 text-gray-400'
            }`}>
              {i < stepIndex ? (
                <svg className={checkSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`${labelSize} whitespace-nowrap ${
              i <= stepIndex ? 'text-primary font-medium' : 'text-gray-400'
            }`}>{label}</span>
          </div>
          {i < labels.length - 1 && (
            <div className={`flex-1 ${lineHeight} mx-1 rounded self-start ${lineOffset} ${
              i < stepIndex ? 'bg-primary' : 'bg-gray-200'
            }`} />
          )}
        </Fragment>
      ))}
    </div>
  );
}
