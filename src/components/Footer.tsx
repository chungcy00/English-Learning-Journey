import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-[#D4CCBC] bg-[#F2EEE4] py-8 px-4 sm:px-8 mt-auto">
      <div className="max-w-4xl mx-auto text-center space-y-2">
        <p className="font-ui text-xs text-[#717265]">
          © 2026 Mine English. All rights reserved.
        </p>
        <p className="font-ui text-[11px] text-[#717265] max-w-2xl mx-auto leading-relaxed">
          This material was created with AI assistance and reviewed and edited by a human. For personal learning use only. Redistribution, resale, republication, or commercial reuse is prohibited without prior written permission.
        </p>
      </div>
    </footer>
  );
};
