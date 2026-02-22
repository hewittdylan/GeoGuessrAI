import React from 'react';

interface DebugPanelProps {
    urls: string[];
    predictions: Array<{
        lat: number;
        lng: number;
        confidence: number;
    }>;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ urls, predictions }) => {
    if (urls.length === 0) return null;

    return (
        <div className="absolute left-4 top-20 w-80 bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-xl overflow-y-auto max-h-[80vh] z-40">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <span>Análisis de IA</span>
            </h3>

            {/* Grid de imágenes */}
            <div className="grid grid-cols-2 gap-2 mb-6">
                {urls.map((url, idx) => (
                    <div key={idx} className="relative group aspect-square">
                        <img
                            src={url}
                            alt={`View ${idx + 1}`}
                            className="w-full h-full object-cover rounded-lg border border-slate-600 group-hover:border-blue-500 transition-colors"
                        />
                        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                            {['N', 'E', 'S', 'W'][idx]}
                        </div>
                    </div>
                ))}
            </div>

            {/* Top 5 Predicciones */}
            <div className="space-y-3">
                <h4 className="text-sm uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-700 pb-2">
                    Top 5 Predicciones
                </h4>

                {predictions.length === 0 ? (
                    <div className="text-slate-500 text-sm italic">Esperando predicción...</div>
                ) : (
                    <div className="space-y-2">
                        {predictions.map((pred, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-slate-800/50 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-600">
                                <div className="flex flex-col">
                                    <span className="text-slate-300 font-mono">
                                        {pred.lat.toFixed(2)}, {pred.lng.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${idx === 0 ? 'bg-green-500' : 'bg-blue-500'}`}
                                            style={{ width: `${pred.confidence * 100}%` }}
                                        />
                                    </div>
                                    <span className={`font-bold ${idx === 0 ? 'text-green-400' : 'text-blue-400'}`}>
                                        {(pred.confidence * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DebugPanel;
