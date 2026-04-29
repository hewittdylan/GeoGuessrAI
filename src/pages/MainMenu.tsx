import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import backgroundImage from '../assets/background.jpg';

interface ModelInfo {
    name: string;
    type: string;
}

const MainMenu = () => {
    const navigate = useNavigate();
    const [models, setModels] = useState<Record<string, ModelInfo>>({});
    const [selectedModel1, setSelectedModel1] = useState<string>('');
    const [selectedModel2, setSelectedModel2] = useState<string>('');
    const [isHumanVsAiMenu, setIsHumanVsAiMenu] = useState(false);
    const [isAiVsAiMenu, setIsAiVsAiMenu] = useState(false);

    useEffect(() => {
        fetch('http://localhost:8000/models')
            .then(res => res.json())
            .then(data => {
                setModels(data);
                const modelKeys = Object.keys(data);
                if (modelKeys.length > 0) {
                    setSelectedModel1(modelKeys[0]);
                    setSelectedModel2(modelKeys[0]);
                }
            })
            .catch(err => console.error("Error fetching models", err));
    }, []);

    const handleStartHumanVsAi = () => {
        navigate('/play', { state: { gameMode: 'human_vs_ai', model2Id: selectedModel1 } });
    };

    const handleStartAiVsAi = () => {
        navigate('/play', { state: { gameMode: 'ai_vs_ai', model1Id: selectedModel1, model2Id: selectedModel2 } });
    };

    return (
        <div className="relative w-full h-screen bg-black flex flex-col items-center justify-center overflow-hidden">
            {/* Foto de fondo */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-100 blur-[0.5px] scale-105"
                style={{ backgroundImage: `url(${backgroundImage})` }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/90"></div>

            {/* Títulos y botones */}
            <div className="relative z-10 flex flex-col items-center gap-12 max-w-4xl px-4">

                {/* Título */}
                <div className="text-center space-y-2">
                    <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-accent via-secondary to-primary drop-shadow-2xl tracking-tighter">
                        GEOGUESSR AI
                    </h1>
                    <p className="text-text/80 text-xl font-mono tracking-widest uppercase">
                        Compite contra la IA
                    </p>
                </div>

                {/* Botones del menú */}
                <div className="flex flex-col gap-4 w-full max-w-sm">
                    {/* Botón Humano vs IA */}
                    {!isHumanVsAiMenu && !isAiVsAiMenu && (
                        <>
                            <button
                                onClick={() => setIsHumanVsAiMenu(true)}
                                className="group relative px-8 py-4 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-primary/30 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-[0_0_30px_rgba(245,158,11,0.5)]"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-secondary/20 to-primary/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <span className="relative text-2xl font-black text-text tracking-wider flex items-center justify-center gap-3">
                                    HUMANO VS IA
                                </span>
                            </button>

                            <button
                                onClick={() => setIsAiVsAiMenu(true)}
                                className="group relative px-8 py-4 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-primary/30 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-[0_0_30px_rgba(245,158,11,0.5)]"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-secondary/20 to-primary/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <span className="relative text-2xl font-black text-text tracking-wider flex items-center justify-center gap-3">
                                    IA VS IA
                                </span>
                            </button>
                        </>
                    )}

                    {/* Menú Humano vs IA */}
                    {isHumanVsAiMenu && (
                        <div className="bg-black/60 p-6 rounded-xl border border-primary/50 backdrop-blur-lg flex flex-col gap-4">
                            <h2 className="text-xl text-primary font-bold text-center mb-2">Selecciona el Modelo IA</h2>
                            <select
                                className="w-full bg-slate-800 text-white p-3 rounded-lg border border-slate-600 focus:outline-none focus:border-primary"
                                value={selectedModel1}
                                onChange={(e) => setSelectedModel1(e.target.value)}
                            >
                                {Object.entries(models).map(([id, info]) => (
                                    <option key={id} value={id}>{info.name}</option>
                                ))}
                            </select>
                            <div className="flex gap-2 mt-4">
                                <button onClick={() => setIsHumanVsAiMenu(false)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-bold transition-colors">Volver</button>
                                <button onClick={handleStartHumanVsAi} className="flex-1 py-2 bg-primary hover:bg-accent rounded-lg text-background font-bold transition-colors">Jugar</button>
                            </div>
                        </div>
                    )}

                    {/* Menú IA vs IA */}
                    {isAiVsAiMenu && (
                        <div className="bg-black/60 p-6 rounded-xl border border-primary/50 backdrop-blur-lg flex flex-col gap-4">
                            <h2 className="text-xl text-primary font-bold text-center mb-2">Configura el Enfrentamiento</h2>

                            <label className="text-sm text-slate-300 font-bold -mb-2">IA 1</label>
                            <select
                                className="w-full bg-slate-800 text-white p-3 rounded-lg border border-slate-600 focus:outline-none focus:border-primary"
                                value={selectedModel1}
                                onChange={(e) => setSelectedModel1(e.target.value)}
                            >
                                {Object.entries(models).map(([id, info]) => (
                                    <option key={id} value={id}>{info.name}</option>
                                ))}
                            </select>

                            <label className="text-sm text-slate-300 font-bold -mb-2 mt-2">IA 2</label>
                            <select
                                className="w-full bg-slate-800 text-white p-3 rounded-lg border border-slate-600 focus:outline-none focus:border-primary"
                                value={selectedModel2}
                                onChange={(e) => setSelectedModel2(e.target.value)}
                            >
                                {Object.entries(models).map(([id, info]) => (
                                    <option key={id} value={id}>{info.name}</option>
                                ))}
                            </select>

                            <div className="flex gap-2 mt-4">
                                <button onClick={() => setIsAiVsAiMenu(false)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-bold transition-colors">Volver</button>
                                <button onClick={handleStartAiVsAi} className="flex-1 py-2 bg-primary hover:bg-accent rounded-lg text-background font-bold transition-colors">Jugar</button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default MainMenu;
