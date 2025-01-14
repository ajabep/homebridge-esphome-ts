import { AsyncEvent } from 'ts-events';

AsyncEvent.setScheduler(function (callback) {
    setTimeout(callback, 25);
});

export enum ClimateMode {
    OFF = 0,
    AUTO = 1, // => Characteristic.TargetHeaterCoolerState.AUTO
    COOL = 2, // => Characteristic.TargetHeaterCoolerState.COOL
    HEAT = 3, // => Characteristic.TargetHeaterCoolerState.HEAT
    FAN_ONLY = 4,
    DRY = 5,
}

enum ClimateFanState {
    ON = 0,
    OFF = 1,
    AUTO = 2,
    LOW = 3,
    MEDIUM = 4,
    HIGH = 5,
    MIDDLE = 6,
    FOCUS = 7,
    DIFFUSED = 8,
    QUIET = 9,
}

enum SwingMode {
    OFF = 0,
    HORIZONTAL = 1,
    VERTICAL = 2,
    BOTH = 3,
}

export class ClimateState {
    private date: Date = new Date();
    private temperatureLastChanged: number = this.date.getTime();

    private Active: boolean = false;
    private FanMode: ClimateFanState = ClimateFanState.OFF;
    private ClimateMode: ClimateMode = ClimateMode.OFF;
    private PreviousClimateMode: ClimateMode = ClimateMode.OFF;
    private SwingMode: SwingMode = SwingMode.OFF; // RotationDirection
    private SupportTwoPointTargetTemperature: boolean = false;

    private key: string = '';

    private TargetTemperature: number = 20;
    private CurrentTemperature: number = 20;
    private TargetTemperatureLow: number = 20;
    private TargetTemperatureHigh: number = 20;

    private connection: any;
    private changesMade: boolean = false;

    private updateEvent = new AsyncEvent<boolean>();

    // private previousClimateState : ClimateState = null;

    // implement ClimateState constructor
    public constructor(connection: any, key: string) {
        this.connection = connection;
        this.key = key;
        this.updateEvent.attach(this, this.update);
    }

    // create event listener for update variable
    public updateEsp(): void {
        this.updateEvent.post(true);
    }

    private update() {
        if (!this.changesMade) {
            return;
        }
        this.changesMade = false; // stop the spam

        let targetTemperatureLow: number = this.TargetTemperature;
        let targetTemperatureHigh: number = this.TargetTemperature;

        if (this.SupportTwoPointTargetTemperature) {
            targetTemperatureLow =
                this.ClimateMode === ClimateMode.AUTO ? this.targetTemperatureLow : this.TargetTemperature;
            targetTemperatureHigh =
                this.ClimateMode === ClimateMode.AUTO ? this.targetTemperatureHigh : this.TargetTemperature;
        }
        const state = {
            key: this.key,
            swingMode: this.SwingMode,
            fanMode: this.FanMode,
            mode: this.ClimateMode, // Heater/Cooler ClimateMode
            targetTemperature: this.TargetTemperature,
            targetTemperatureLow: targetTemperatureLow,
            targetTemperatureHigh: targetTemperatureHigh,
        };

        this.connection.climateCommandService(state);
    }

    public get active(): boolean {
        return this.Active;
    }
    public set active(value: boolean) {
        // console.log(`active ${value}`);
        let mode = this.Active ? this.ClimateMode : this.PreviousClimateMode;
        if (value && (mode === undefined || mode === ClimateMode.OFF)) {
            mode = ClimateMode.AUTO;
        }

        if (this.Active !== value) {
            this.changesMade = true;
        }

        if (!value) {
            this.PreviousClimateMode = this.ClimateMode;
            mode = ClimateMode.OFF;
        }
        this.ClimateMode = mode;
        this.Active = value;
    }

    public get fanMode(): ClimateFanState {
        return this.FanMode;
    }
    public set fanMode(value: ClimateFanState) {
        // console.log(`fanMode ${value}`);
        // this.previousClimateState = Object.assign({}, this);

        if (this.FanMode !== value) {
            this.changesMade = true;
        }
        this.FanMode = value;
    }
    public get climateMode(): ClimateMode {
        return this.ClimateMode;
    }
    public set climateMode(value: ClimateMode) {
        // console.log(`climateMode ${value}`);
        if (this.ClimateMode !== value) {
            this.changesMade = true;
        }
        this.ClimateMode = value;
    }

    public get swingMode(): SwingMode {
        return this.SwingMode;
    }
    public set swingMode(value: SwingMode) {
        // console.log(`swingMode ${value}`);
        if (this.SwingMode !== value) {
            this.changesMade = true;
        }
        this.SwingMode = value;
    }

    public get targetTemperature(): number {
        return this.TargetTemperature;
    }
    public set targetTemperature(value: number) {
        // console.log(`targetTemperature ${value}`);
        if (this.targetTemperature !== value) {
            this.changesMade = true;
        }

        this.temperatureLastChanged = this.date.getTime();
        this.TargetTemperature = value;
    }
    public get currentTemperature(): number {
        return this.CurrentTemperature;
    }
    public set currentTemperature(value: number) {
        // console.log(`currentTemperature ${value}`);
        this.CurrentTemperature = value;
    }
    public get targetTemperatureLow(): number {
        return this.TargetTemperatureLow;
    }
    public set targetTemperatureLow(value: number) {
        // console.log(`targetTemperatureLow ${value}`);
        if (this.targetTemperatureLow !== value) {
            this.changesMade = true;
        }

        this.ClimateMode = this.getClimateMode(ClimateMode.COOL);
        this.TargetTemperatureLow = value;
    }
    public get targetTemperatureHigh(): number {
        return this.TargetTemperatureHigh;
    }

    public set targetTemperatureHigh(value: number) {
        // console.log(`targetTemperatureHigh ${value}`);
        if (this.targetTemperatureHigh !== value) {
            this.changesMade = true;
        }

        this.ClimateMode = this.getClimateMode(ClimateMode.HEAT);
        this.TargetTemperatureHigh = value;
    }

    public get supportTwoPointTargetTemperature(): boolean {
        return this.SupportTwoPointTargetTemperature;
    }
    public set supportTwoPointTargetTemperature(value: boolean) {
        // console.log(`supportTwoPointTargetTemperature ${value}`);
        this.SupportTwoPointTargetTemperature = value;
    }

    private getClimateMode(mode: ClimateMode): ClimateMode {
        let state: any;
        // 2 events will be received, so we need to capture both to set the mode to AUTO
        if (Math.abs(this.date.getTime() - this.temperatureLastChanged) < 50) {
            return ClimateMode.AUTO;
        } else {
            return mode;
        }
    }
}
