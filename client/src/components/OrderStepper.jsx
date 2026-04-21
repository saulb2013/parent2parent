import { Fragment } from 'react';

function getStepIndex(orderStatus) {
  if (orderStatus === 'delivered') return 3;
  if (orderStatus === 'shipped')   return 2;
  if (orderStatus === 'paid')      return 1;
  return 0; // pending
}

// Step icons — each is a mini SVG
function BagIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
    </svg>
  );
}

function BoxIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
}

function TruckIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

const STEP_ICONS = [BagIcon, BoxIcon, TruckIcon, CheckIcon];
const STEP_LABELS = ['Pending', 'Paid', 'In Transit', 'Delivered'];

export default function OrderStepper({ status, deliveryMethod, hasTracking, size = 'sm' }) {
  if (status === 'cancelled' || status === 'refunded') {
    const label = status === 'cancelled' ? 'Cancelled' : 'Refunded';
    const cls = status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
  }

  const stepIndex = getStepIndex(status);
  const isDelivery = deliveryMethod === 'delivery';
  const labels = [...STEP_LABELS];
  if (isDelivery && hasTracking && stepIndex >= 1) labels[1] = 'Courier Booked';

  const lg = size === 'lg';

  return (
    <div className="flex items-start w-full">
      {labels.map((label, i) => {
        const done = i <= stepIndex;
        const isCurrent = i === stepIndex;
        const Icon = STEP_ICONS[i];

        // Sizes
        const dotSize = isCurrent
          ? (lg ? 'w-11 h-11' : 'w-9 h-9')
          : (lg ? 'w-9 h-9' : 'w-7 h-7');
        const iconSize = isCurrent
          ? (lg ? 'w-5 h-5' : 'w-4 h-4')
          : (lg ? 'w-4 h-4' : 'w-3.5 h-3.5');

        // Line vertical center aligns with the non-current dot center
        const lineTop = lg ? 'top-[18px]' : 'top-[14px]';

        return (
          <Fragment key={i}>
            <div className="flex flex-col items-center shrink-0 relative">
              {/* Emphasis ring for current step */}
              {isCurrent && (
                <div className={`absolute rounded-full bg-primary/10 ${
                  lg ? 'w-14 h-14 -top-1.5' : 'w-12 h-12 -top-1.5'
                }`} style={{ left: '50%', transform: 'translateX(-50%)' }} />
              )}
              <div className={`${dotSize} rounded-full flex items-center justify-center relative z-10 transition-all ${
                done
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400 border border-gray-200'
              }`}>
                <Icon className={iconSize} />
              </div>
              <span className={`whitespace-nowrap relative z-10 ${
                lg ? 'text-[11px] mt-2' : 'text-[10px] mt-1'
              } ${
                isCurrent ? 'text-primary font-bold' :
                done ? 'text-primary font-medium' : 'text-gray-400'
              }`}>{label}</span>
            </div>
            {/* Connector line */}
            {i < labels.length - 1 && (
              <div className={`flex-1 relative ${lineTop} mx-0.5`} style={{ height: lg ? 3 : 2 }}>
                <div className={`absolute inset-0 rounded-full bg-gray-200`} />
                {i < stepIndex && (
                  <div className="absolute inset-0 rounded-full bg-primary" />
                )}
                {i === stepIndex && (
                  <div className="absolute top-0 bottom-0 left-0 rounded-full bg-primary/30" style={{ width: '40%' }} />
                )}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
