import { Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch(Error, WsException, HttpException)
export class GlobalWsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger('GlobalWsExceptionFilter');

  catch(exception: WsException | HttpException, host: ArgumentsHost) {
    this.logger.debug('GlobalWsExceptionFilter caught an exception', exception);

    const client = host.switchToWs().getClient<Socket>();
    const data = host.switchToWs().getData();
    const user = client.user; // Assuming user is attached to socket

    // Extract event name from WebSocket args
    let eventName = 'unknown_event';
    try {
      const args = host.getArgs();
      // Based on debug logs: args[3] contains the event name
      if (args && args.length > 3 && typeof args[3] === 'string') {
        eventName = args[3];
        this.logger.debug(`Extracted event name: ${eventName}`);
      } else {
        this.logger.debug('Event name not found in expected position args[3]');
      }
    } catch (error) {
      // Fallback to unknown_event if extraction fails
      this.logger.warn('Failed to extract event name from WebSocket args:', error);
    }

    let errorResponse: { status: string; message: string; details?: any };
    let statusCode: number;

    if (exception instanceof WsException) {
      const wsError = exception.getError();
      const message = typeof wsError === 'string' ? wsError : (wsError as any)?.message || 'WebSocket Error';
      errorResponse = {
        status: 'error',
        message: message,
      };
      statusCode = (wsError as any)?.statusCode || 500; // Default to 500 if no specific code
      this.logger.warn(
        `WsException caught for user ${user?.nickname || client.id} in event ${eventName}: ${message} (Data: ${JSON.stringify(data)})`,
      );
    } else if (exception instanceof HttpException) {
      const httpError = exception.getResponse();
      const message =
        typeof httpError === 'string' ? httpError : (httpError as any)?.message || 'HTTP Exception via WebSocket';
      errorResponse = {
        status: 'error',
        message: message,
        details: typeof httpError === 'object' ? httpError : undefined,
      };
      statusCode = exception.getStatus();
      this.logger.warn(
        `HttpException caught (via WebSocket) for user ${user?.nickname || client.id} in event ${eventName}: ${message} (Status: ${statusCode}, Data: ${JSON.stringify(data)})`,
      );
    } else {
      // Fallback for unhandled exceptions
      errorResponse = {
        status: 'error',
        message: 'Internal server error via WebSocket',
      };
      statusCode = 500;
      this.logger.error(
        `Unhandled exception caught (via WebSocket) for user ${user?.nickname || client.id} in event ${eventName}: ${exception}`,
        (exception as Error).stack,
      );
    }

    // Emit an error event back to the specific client
    // The event name 'exception' is a common practice, but can be customized
    client.emit('exception', {
      event: eventName, // Use the extracted event name
      data: errorResponse,
      statusCode: statusCode, // Optional: include status code if meaningful for client
    });

    // Optionally, you might want to call the base filter if needed,
    // or ensure the connection isn't prematurely closed depending on the error.
    // super.catch(exception, host); // If you want to retain some base behavior
  }
}
