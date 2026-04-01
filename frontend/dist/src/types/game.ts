export interface MatchInfos {
	end_time: number | null;
	id: number;
	initiator: string;
	opponent_id: number;
	start_time: string;
	status: string;
	type: string;
	tournament_id: number | null;
	winnder_id: number | null;
};

export interface vector2 {
	x: number;
	y: number;
};

export interface MatchPositions {
	p1Paddle: number; // ymin = 0;
	p2Paddle: number; // ymin = 0;
	ball: vector2;
};
