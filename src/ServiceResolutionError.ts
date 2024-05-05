import type { NamedServiceKey, ServicesMap } from "./ServiceResolver";
import { stringifyServiceKey } from "./stringifyServiceKey";

/**
 * Service resolution error class.
 */
export class ServiceResolutionError<
  TServicesMap extends ServicesMap,
> extends Error {
  /**
   * ServiceResolutionError constructor.
   *
   * @param message
   * @param resolutionStack
   * @param cause
   */
  constructor(
    message: string,
    readonly resolutionStack: NamedServiceKey<TServicesMap>[],
    readonly cause: Error | unknown
  ) {
    const resolutionStackMessage = resolutionStack
      .slice()
      .reverse()
      .map(
        (entry) =>
          `Resolving service ${stringifyServiceKey(entry.service)}, named "${entry.name}"`
      )
      .join("\n");

    const errorMessage =
      message +
      (cause ? `\n${cause}` : "") +
      `\nResolution stack:\n${resolutionStackMessage}`;

    super(errorMessage);
    this.name = "ServiceResolutionError";
  }
}
