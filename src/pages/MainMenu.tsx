
import { useNavigate } from 'react-router-dom';
import backgroundImage from '../assets/background.jpg';

const MainMenu = () => {
    const navigate = useNavigate();

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
                    <button
                        onClick={() => navigate('/play', { state: { gameMode: 'human_vs_ai' } })}
                        className="group relative px-8 py-4 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-primary/30 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-[0_0_30px_rgba(245,158,11,0.5)]"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-secondary/20 to-primary/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="relative text-2xl font-black text-text tracking-wider flex items-center justify-center gap-3">
                            <span className="text-3xl"></span> HUMANO VS IA
                        </span>
                    </button>

                    {/* Botón IA vs IA */}
                    <button
                        onClick={() => navigate('/play', { state: { gameMode: 'ai_vs_ai' } })}
                        className="group relative px-8 py-4 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-primary/30 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-[0_0_30px_rgba(245,158,11,0.5)]"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-secondary/20 to-primary/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="relative text-2xl font-black text-text tracking-wider flex items-center justify-center gap-3">
                            <span className="text-3xl"></span> IA VS IA
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MainMenu;
