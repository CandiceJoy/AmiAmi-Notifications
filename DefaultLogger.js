import winston from "winston";

const myCustomLevels = {
	levels: {
		fatal: 0,
		error: 1,
		warn : 2,
		info : 3,
		debug: 4,
		trace: 5,
		data : 6
	},
	colors: {
		fatal: 'magenta',
		error: 'red',
		warn : 'yellow',
		info : 'blue',
		debug: 'cyan',
		trace: 'green',
		data : 'orange'
	}
};

let padLength = 0;

for(const level in myCustomLevels.levels)
{
	if(level.length > padLength)
	{
		padLength = level.length;
	}
}

function padLevel(level)
{
	const matches = level.match(new RegExp("(?:\\x1B\\[\\d\\dm)?(\\w+)\\s*(?:\\x1B\\[\\d\\dm)?", ""));
	const match = matches[1];
	let levelCopy = match;

	while(levelCopy.length < padLength)
	{
		levelCopy = " " + levelCopy;
	}

	return level.replace(match, levelCopy);
}

const myformat = winston.format.combine(winston.format.timestamp({format: "YYYY-MM-DD hh:mm:ss.SSS A"}),
                                        winston.format.align(), winston.format.splat(), winston.format.prettyPrint(),
                                        winston.format.printf(
	                                        info => `[${info.timestamp}] ${padLevel(info.level)}: ${info.message}`));

const myformatWithColors = winston.format.combine(winston.format.colorize(), myformat);

winston.addColors(myCustomLevels.colors);

const transports = [new winston.transports.Console({
	                                                   format: myformatWithColors,
	                                                   level : "info"
                                                   }), new winston.transports.File({
	                                                                                   options : {flags: 'w'},
	                                                                                   format  : myformat,
	                                                                                   filename: 'trace.log',
	                                                                                   level   : 'trace'
                                                                                   }), new winston.transports.File({
	                                                                                                                   options : {flags: 'w'},
	                                                                                                                   format  : myformat,
	                                                                                                                   filename: 'data.log',
	                                                                                                                   level   : 'data'
                                                                                                                   })];

export const log = winston.createLogger({
	                                        levels           : myCustomLevels.levels,
	                                        transports       : transports,
	                                        handleExceptions : true,
	                                        handleRejections : true,
	                                        exceptionHandlers: transports,
	                                        exitOnError      : true,
	                                        rejectionHandlers: transports
                                        });

export function logTest(logger = log)
{
	logger.trace("This is a trace line.");
	logger.debug("This is a debug line.");
	logger.info("This is an info line.");
	logger.warn("This is a warning line.");
	logger.error("This is an error line.");
	logger.fatal("This is a fatal error line.");
}