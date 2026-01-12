import React from 'react';
import { Loader2 } from 'lucide-react';

export type LoadingVariant = 'fullscreen' | 'overlay' | 'block' | 'inline';
export type LoadingSize = 'sm' | 'md' | 'lg' | 'xl';

export interface LoadingProps {
    /**
     * The visual style of the loader.
     * - `fullscreen`: Covers the entire viewport with a backdrop.
     * - `overlay`: Positioned absolutely to cover a relative parent container.
     * - `block`: A flex container that takes up available space (default).
     * - `inline`: Small, inline-flex for buttons or text.
     */
    variant?: LoadingVariant;
    /**
     * Size of the spinner.
     * @default 'md'
     */
    size?: LoadingSize;
    /**
     * Optional text to display next to or below the spinner.
     */
    text?: string;
    /**
     * Additional CSS classes.
     */
    className?: string;
}

const sizeClasses: Record<LoadingSize, string> = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
    xl: 'w-16 h-16',
};

const variantContainerClasses: Record<LoadingVariant, string> = {
    fullscreen: 'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm',
    overlay: 'absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-[inherit]',
    block: 'flex flex-col items-center justify-center w-full py-12 min-h-[200px]',
    inline: 'inline-flex items-center gap-2',
};

const Loading: React.FC<LoadingProps> = ({
                                             variant = 'block',
                                             size = 'md',
                                             text,
                                             className = ''
                                         }) => {
    return (
        <div className={`${variantContainerClasses[variant]} ${className}`}>
            <Loader2 className={`${sizeClasses[size]} animate-spin text-neutral-900`} />
            {text && (
                <p className={`text-neutral-500 font-medium ${variant === 'inline' ? 'text-sm' : 'mt-3 text-sm animate-pulse'}`}>
                    {text}
                </p>
            )}
        </div>
    );
};

export default Loading;