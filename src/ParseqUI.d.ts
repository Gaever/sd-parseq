import { DataPoint, Indexable } from "downsample";
import { TimeSeries } from "./parseq-lang/parseq-timeseries";

declare module 'uuid4';
declare module 'chartjs-plugin-crosshair';
declare module 'react-copy-to-clipboard';


type ParseqMetadata = {
    docName?: string;
    generated_by: string;
    version: string;
    generated_at: string;
};

type DocId = string & { _docIdBrand: undefined };
type VersionId = string & { _versionIdBrand: undefined };

type ParseqDoc = {
    docId: DocId,
    name: string,
    timestamp: number,
    latestVersionId?: VersionId,
}

type ParseqPersistableState = {
    meta: ParseqMetadata;
    options: ParseqOptions;
    displayedFields?: string[];
    managedFields: string[];
    timeSeries: [
        {
            alias: string;
            ts: TimeSeries;
        }
    ] | [];
    prompts: ParseqPrompts;
    keyframes: ParseqKeyframes;
    keyframeLock: "frames" | "seconds" | "beats";
    reverseRender?: boolean;
}


type Color = [number, number, number];

type InterpolatableFieldDefinition = {
    name: string;
    description: string;
    type: "number" | "string";
    defaultValue: number | string;
    color: Color;
    labels: string[];
}

type ParseqDocVersion = ParseqPersistableState & {
    versionId: VersionId,
    docId: DocId;
    timestamp: number;
    changes?: string[];
}

type ParseqOptions = {
    input_fps?: number;
    bpm: number;
    output_fps: number;
    cc_window_width?: number;
    cc_window_slide_rate?: number;
    cc_use_input?: boolean;
    cadence?: number;
};

type SimpleParseqPrompts = {
    positive: string;
    negative: string;
};

type Template = {
    name: string;
    description: string;
    template: {
        options?: ParseqOptions;
        managedFields?: string[];        
        displayedFields?: string[];
        prompts: ParseqPrompts;
        keyframes: ParseqKeyframes;
        timeSeries?: TimeSeries[] | [];
        keyframeLock?: "frames" | "seconds" | "beats";
        reverseRender?: boolean;
    }
}

type OverlapType = "none" | "linear" | "custom";

type Overlap = {
    type: OverlapType;
    custom: string;
    inFrames: number;
    outFrames: number;
}

type AdvancedParseqPrompt = {
    enabled?: boolean; // defaults to true
    positive: string;
    negative: string;
    allFrames: boolean;
    from: number;
    to: number;
    name: string;
    overlap: Overlap;
};

type AdvancedParseqPrompts = AdvancedParseqPrompt[] | [];

type AdvancedParseqPromptsV2 = {
    format: "v2";
    enabled: boolean;
    promptList: AdvancedParseqPrompt[] | [];
    commonPrompt: AdvancedParseqPrompt;
    commonPromptPos: "append" | "prepend"
}

type ParseqPrompts = SimpleParseqPrompts | AdvancedParseqPrompts | AdvancedParseqPromptsV2;


type ParseqKeyframe = {
    frame: number;
    // TODO: make this stricter
    [key: string]: string | number;
}

type ParseqKeyframes = ParseqKeyframe[] | [];

type ParseqRenderedFrames = [{
    frame: number;
    // TODO: make this stricter
    //@ts-ignore
    deforum_prompt: string;
    [key: string]: number;
}] | [];

// Min, max, isAnimated... for each field.
type ParseqRenderedFramesMeta = [{
    // TODO: make this stricter 
    [key: string]: {
        min: number;
        max: number;
        isFlat: boolean;
    };
}] | [];

type Point = {x:number, y:number};

type GraphableData = {
    [key: string]: Point[]
};


type SparklineData = Indexable<DataPoint>;

type RenderedData = ParseqPersistableState & {
    rendered_frames: ParseqRenderedFrames;
    rendered_frames_meta: ParseqRenderedFramesMeta;
};