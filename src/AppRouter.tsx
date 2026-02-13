import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainMenu from './pages/MainMenu';
import GameMatch from './pages/GameMatch';

const AppRouter = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<MainMenu />} />
                <Route path="/play" element={<GameMatch />} />
            </Routes>
        </BrowserRouter>
    );
};

export default AppRouter;
