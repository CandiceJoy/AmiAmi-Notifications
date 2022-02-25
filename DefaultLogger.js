import * as util from "util";
import winston   from "winston";

const myCustomLevels = {
	levels: {
		fatal: 0,
		error: 1,
		warn:  2,
		info:  3,
		debug: 4,
		trace: 5
	},
	colors: {
		fatal: 'magenta',
		error: 'red',
		warn:  'yellow',
		info:  'blue',
		debug: 'cyan',
		trace: 'green'
	}
};

class CustomTransport extends winston.transports.Console
{
	constructor( opts )
	{
		super( opts );

		//
		// Consume any custom options here. e.g.:
		// - Connection information for databases
		// - Authentication information for APIs (e.g. loggly, papertrail,
		//   logentries, etc.).
		//
	}

	log( info, callback )
	{
		super.log( info, () =>
		{
			const level = info.level.toLowerCase();

			if( level.includes( "fatal" ) && !level.includes("not") )
			{
				process.exit( 1 );
			}
			else
			{
				callback();
			}
		} );
	}
}

const myformat = winston.format.combine(
	winston.format.colorize(),
	winston.format.timestamp(),
	winston.format.align(),
	winston.format.splat(),
	winston.format.printf( info => `${ info.timestamp } ${ info.level }: ${ info.message }` )
);
winston.addColors( myCustomLevels.colors );

const transport = new CustomTransport( {
	                                       format: myformat,
	                                       level:  "trace"
                                       } );

export const log = winston.createLogger( {
	                                         levels:            myCustomLevels.levels,
	                                         transports:        [transport],
	                                         exceptionHandlers: [transport],
	                                         exitOnError:       true
                                         } );