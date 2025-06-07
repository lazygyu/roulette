import { Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

interface ErrorResponse {
  status: string;
  message: string;
  details?: any;
}

interface ProcessedError {
  response: ErrorResponse;
  statusCode: number;
}

@Catch(Error, WsException, HttpException)
export class GlobalWsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger('GlobalWsExceptionFilter');

  catch(exception: WsException | HttpException, host: ArgumentsHost) {
    this.logger.debug('GlobalWsExceptionFilter caught an exception', exception);

    const client = host.switchToWs().getClient<Socket>();
    const data = host.switchToWs().getData();
    const eventName = this.extractEventName(host);
    const { response, statusCode } = this.processException(exception);
    
    this.logException(exception, client, eventName, response.message, statusCode, data);
    this.emitErrorToClient(client, eventName, response, statusCode);
  }

  private extractEventName(host: ArgumentsHost): string {
    try {
      const args = host.getArgs();
      if (args && args.length > 3 && typeof args[3] === 'string') {
        return args[3];
      }
    } catch (error) {
      this.logger.warn('Failed to extract event name from WebSocket args:', error);
    }
    return 'unknown_event';
  }

  private processException(exception: WsException | HttpException): ProcessedError {
    if (exception instanceof WsException) {
      return this.processWsException(exception);
    } else if (exception instanceof HttpException) {
      return this.processHttpException(exception);
    } else {
      return this.processUnhandledException(exception);
    }
  }

  private processWsException(exception: WsException): ProcessedError {
    const wsError = exception.getError();
    const message = typeof wsError === 'string' ? wsError : (wsError as any)?.message || 'WebSocket Error';
    
    return {
      response: { status: 'error', message },
      statusCode: (wsError as any)?.statusCode || 500,
    };
  }

  private processHttpException(exception: HttpException): ProcessedError {
    const httpError = exception.getResponse();
    const message = typeof httpError === 'string' ? httpError : (httpError as any)?.message || 'HTTP Exception via WebSocket';
    
    return {
      response: {
        status: 'error',
        message,
        details: typeof httpError === 'object' ? httpError : undefined,
      },
      statusCode: exception.getStatus(),
    };
  }

  private processUnhandledException(exception: any): ProcessedError {
    return {
      response: {
        status: 'error',
        message: 'Internal server error via WebSocket',
      },
      statusCode: 500,
    };
  }

  private logException(
    exception: any,
    client: Socket,
    eventName: string,
    message: string,
    statusCode: number,
    data: any,
  ): void {
    const userInfo = client.user?.nickname || client.id;
    const dataStr = JSON.stringify(data);

    if (exception instanceof WsException) {
      this.logger.warn(`WsException caught for user ${userInfo} in event ${eventName}: ${message} (Data: ${dataStr})`);
    } else if (exception instanceof HttpException) {
      this.logger.warn(`HttpException caught (via WebSocket) for user ${userInfo} in event ${eventName}: ${message} (Status: ${statusCode}, Data: ${dataStr})`);
    } else {
      this.logger.error(`Unhandled exception caught (via WebSocket) for user ${userInfo} in event ${eventName}: ${exception}`, (exception as Error).stack);
    }
  }

  private emitErrorToClient(client: Socket, eventName: string, errorResponse: ErrorResponse, statusCode: number): void {
    client.emit('exception', {
      event: eventName,
      data: errorResponse,
      statusCode,
    });
  }
}
