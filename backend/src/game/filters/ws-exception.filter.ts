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
        `WsException caught for user ${user?.nickname || client.id} in event ${data?.event || 'unknown_event'}: ${message} (Data: ${JSON.stringify(data)})`,
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
        `HttpException caught (via WebSocket) for user ${user?.nickname || client.id} in event ${data?.event || 'unknown_event'}: ${message} (Status: ${statusCode}, Data: ${JSON.stringify(data)})`,
      );
    } else {
      // Fallback for unhandled exceptions
      errorResponse = {
        status: 'error',
        message: 'Internal server error via WebSocket',
      };
      statusCode = 500;
      this.logger.error(
        `Unhandled exception caught (via WebSocket) for user ${user?.nickname || client.id} in event ${data?.event || 'unknown_event'}: ${exception}`,
        (exception as Error).stack,
      );
    }

    // Emit an error event back to the specific client
    // The event name 'exception' is a common practice, but can be customized
    client.emit('exception', {
      event: data?.event || 'unknown_event_error', // Include the original event name if available
      data: errorResponse,
      statusCode: statusCode, // Optional: include status code if meaningful for client
    });

    // Optionally, you might want to call the base filter if needed,
    // or ensure the connection isn't prematurely closed depending on the error.
    // super.catch(exception, host); // If you want to retain some base behavior
  }
}
