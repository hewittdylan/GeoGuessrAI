import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform, animate } from 'framer-motion';

interface HealthBarProps {
    current: number;
    max: number;
    color: string;
    label: string;
    isRightAligned?: boolean;
}

const HealthBar: React.FC<HealthBarProps> = ({ current, max, color, label, isRightAligned = false }) => {
    const countSpring = useSpring(current, { stiffness: 100, damping: 20 });
    const roundedScore = useTransform(countSpring, (latest) => Math.round(latest));

    // Estado para la barra de daño
    const [damageWidth, setDamageWidth] = useState((current / max) * 100);

    // Porcentaje actual para la barra principal
    const currentPercent = Math.max(0, (current / max) * 100);

    useEffect(() => {
        // Actualizar el contador
        countSpring.set(current);

        // La barra de daño espera un poco y se actualiza
        const timeout = setTimeout(() => {
            setDamageWidth(currentPercent);
        }, 400); // 400ms de delay para ver el "daño"

        return () => clearTimeout(timeout);
    }, [current, max, currentPercent, countSpring]);

    return (
        <div className={`flex flex-col flex-1 ${isRightAligned ? 'items-start' : 'items-end'}`}>
            <div className={`flex items-center justify-between w-full mb-1 text-white ${isRightAligned ? 'flex-row-reverse' : 'flex-row'}`}>
                <span className="font-bold text-lg drop-shadow-md tracking-wider">{label}</span>
                <motion.span className={`font-mono font-bold text-2xl ${isRightAligned ? 'text-rose-400' : 'text-amber-400'}`}>
                    {roundedScore}
                </motion.span>
            </div>

            <div className="relative w-full h-4 bg-slate-800/80 rounded-full overflow-hidden border border-white/10 shadow-inner">
                {/* Barra de daño animada */}
                <div
                    className="absolute top-0 bottom-0 h-full bg-white transition-all duration-1000 ease-out z-0"
                    style={{
                        width: `${damageWidth}%`,
                        [isRightAligned ? 'right' : 'left']: 0
                    }}
                />

                {/* Barra principal a color */}
                <motion.div
                    className={`absolute top-0 bottom-0 h-full z-20 ${color}`}
                    initial={{ width: `${(current / max) * 100}%` }}
                    animate={{ width: `${currentPercent}%` }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    style={{
                        [isRightAligned ? 'right' : 'left']: 0
                    }}
                />
            </div>
        </div>
    );
};

export default HealthBar;
