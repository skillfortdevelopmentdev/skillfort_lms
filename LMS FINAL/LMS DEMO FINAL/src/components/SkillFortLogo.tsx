import React from 'react';

const LOGO_SRC = '/skillfort-logo.png';

interface SkillFortLogoProps {
  className?: string;
}

export const SkillFortLogo: React.FC<SkillFortLogoProps> = ({ className = '' }) => {
  return (
    <div
      className={`inline-flex h-10 items-center sm:h-11 md:h-12 ${className}`}
    >
      <img
        src={LOGO_SRC}
        alt="SkillFort"
        className="h-full w-auto shrink-0 object-contain object-left"
        draggable={false}
      />
    </div>
  );
};
