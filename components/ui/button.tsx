import React from 'react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => {
  return <button {...props} className={`px-4 py-2 bg-blue-500 text-white rounded ${props.className || ''}`} />;
};
